package caddyjs

import (
	"bytes"
	"context"
	_ "embed"
	"fmt"
	"io"
	"io/ioutil"
	"net/http"
	"runtime"
	"strings"
	"sync/atomic"

	"github.com/caddyserver/caddy/v2"
	"github.com/caddyserver/caddy/v2/caddyconfig/httpcaddyfile"
	"github.com/caddyserver/caddy/v2/modules/caddyhttp"
	"github.com/dop251/goja"
	URL "github.com/nlnwa/whatwg-url/url"
)

//go:embed runtime/output/runtime.js
var runtimeSource string

type RT struct {
	Loop    *EventLoop
	Handler goja.Callable
}

type JS struct {
	Filename string
	Source   string
	Loops    []*RT
	Counter  atomic.Int64
}

func init() {
	caddy.RegisterModule(JS{})
	httpcaddyfile.RegisterHandlerDirective("js", parseCaddyfile)
}

func (JS) CaddyModule() caddy.ModuleInfo {
	return caddy.ModuleInfo{
		ID:  "http.handlers.js",
		New: func() caddy.Module { return new(JS) },
	}
}

type AsyncContext struct {
	r    *http.Request
	next caddyhttp.Handler
}

func (js *JS) ServeHTTP(w http.ResponseWriter, r *http.Request, next caddyhttp.Handler) error {
	rt, err := js.getRuntime()
	if err != nil {
		return err
	}

	waiter := make(chan error)

	rt.Loop.Queue(func(vm VM) {
		rt.Loop.AsyncCtx.Resumed(&AsyncContext{r, next})
		defer rt.Loop.AsyncCtx.Exited()

		request := vm.NewObject()

		request.Set("method", r.Method)

		url := *r.URL
		url.Host = r.Host
		if r.TLS == nil {
			url.Scheme = "http"
		} else {
			url.Scheme = "https"
		}
		request.Set("url", url.String())

		headers := vm.NewObject()
		request.Set("headers", headers)
		for k, v := range r.Header {
			headers.Set(k, strings.Join(v, ", "))
		}

		_, err := rt.Handler(goja.Null(), request, vm.ToValue(func(result goja.Value, err goja.Value) {
			if !goja.IsNull(err) {
				waiter <- fmt.Errorf("JavaScript exception: %v", err)
				return
			}

			obj := result.ToObject(vm)

			w.WriteHeader(int(obj.Get("status").ToFloat()))

			body := obj.Get("body")
			if !goja.IsNull(body) {
				w.Write(body.Export().(goja.ArrayBuffer).Bytes())
			}

			close(waiter)
		}))

		if err != nil {
			waiter <- err
		}
	})

	return <-waiter
}

func (js *JS) getRuntime() (*RT, error) {
	i := int(js.Counter.Add(1) - 1)
	n := i % len(js.Loops)

	if js.Loops[n] == nil {
		rt, err := js.makeRuntime()
		if err != nil {
			return nil, err
		}
		js.Loops[n] = rt
	}

	return js.Loops[n], nil
}

func (js *JS) makeRuntime() (*RT, error) {
	rt := RT{
		Loop:    NewEventLoop(),
		Handler: nil,
	}

	vm := rt.Loop.vm

	vm.Set("__caddy_encode", func(data string) goja.ArrayBuffer { return vm.NewArrayBuffer([]byte(data)) })
	vm.Set("__caddy_decode", func(data goja.ArrayBuffer) string { return string(data.Bytes()) })
	vm.Set("__caddy_url_parse", URL.Parse)
	vm.Set("__caddy_url_parse_ref", URL.ParseRef)

	doFetch := func(method string, url string, headers map[string]string, jsBody goja.Value, jsCallback func(goja.Value, goja.Value)) {
		ctx := rt.Loop.AsyncCtx.Grab().(*AsyncContext)

		callback := func(response *http.Response, err error) {
			rt.Loop.Queue(func(vm VM) {
				rt.Loop.AsyncCtx.Resumed(ctx)
				defer rt.Loop.AsyncCtx.Exited()

				if err != nil {
					jsCallback(goja.Null(), vm.ToValue(err))
					return
				}

				obj := vm.NewObject()

				if response.Body != nil {
					defer response.Body.Close()
					data, err := ioutil.ReadAll(response.Body)
					if err != nil {
						jsCallback(goja.Null(), vm.ToValue(err))
						return
					}
					obj.Set("body", vm.NewArrayBuffer(data))
				}

				obj.Set("status", float64(response.StatusCode))

				headers := vm.NewObject()
				obj.Set("headers", headers)
				for k, v := range response.Header {
					headers.Set(k, strings.Join(v, ", "))
				}

				jsCallback(obj, goja.Null())
			})
		}

		var body []byte
		if !goja.IsNull(jsBody) {
			body = jsBody.Export().(goja.ArrayBuffer).Bytes()
		}

		go func() {
			url, err := URL.Parse(url)
			if err != nil {
				callback(nil, err)
				return
			}

			isForOrigin := url.Host() == ctx.r.Host

			body := bytes.NewReader(body)

			var req *http.Request
			if isForOrigin {
				req, err = http.NewRequestWithContext(ctx.r.Context(), method, url.String(), body)
			} else {
				req, err = http.NewRequestWithContext(context.Background(), method, url.String(), body)
			}
			if err != nil {
				callback(nil, err)
				return
			}

			req.Header = http.Header{}

			var res *http.Response
			if isForOrigin {
				rw := &FakeResponseWriter{
					StatusCode: 0,
					Headers:    http.Header{},
					Body:       bytes.NewBuffer(nil),
					Done:       make(chan int),
				}

				go func() {
					ctx.next.ServeHTTP(rw, req)
				}()

				<-rw.Done

				res = new(http.Response)
				res.StatusCode = rw.StatusCode
				res.Header = rw.Headers
				res.ContentLength = int64(rw.Body.Len())
				res.Body = io.NopCloser(rw.Body)
			} else {
				res, err = http.DefaultClient.Do(req)
			}

			callback(res, nil)
		}()
	}

	vm.Set("__caddy_fetch", doFetch)

	_, err := vm.RunScript("runtime", runtimeSource)
	if err != nil {
		return nil, err
	}

	handler, ok := goja.AssertFunction(vm.Get("__caddy_handle_request"))
	if !ok {
		return nil, fmt.Errorf("Unable to get __caddy_handle_request")
	}
	rt.Handler = handler

	_, err = vm.RunScript(js.Filename, js.Source)
	if err != nil {
		return nil, err
	}

	return &rt, nil
}

func parseCaddyfile(h httpcaddyfile.Helper) (caddyhttp.MiddlewareHandler, error) {
	var js JS

	h.Next()

	if !h.NextArg() {
		return nil, h.ArgErr()
	}
	filename := h.Val()
	js.Filename = filename

	buf, err := ioutil.ReadFile(filename)
	if err != nil {
		return nil, err
	}
	js.Source = string(buf)

	js.Loops = make([]*RT, runtime.NumCPU())

	return &js, nil
}

type FakeResponseWriter struct {
	StatusCode int
	Headers    http.Header
	Body       *bytes.Buffer
	Done       chan int
}

func (f *FakeResponseWriter) WriteHeader(status int) {
	f.StatusCode = status
	close(f.Done)
}

func (f *FakeResponseWriter) Write(buf []byte) (int, error) {
	if f.StatusCode == 0 {
		f.WriteHeader(200)
	}

	return f.Body.Write(buf)
}

func (f *FakeResponseWriter) Header() http.Header {
	return f.Headers
}
