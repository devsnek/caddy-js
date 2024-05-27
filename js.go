package caddyjs

import (
	"fmt"
	"io/ioutil"
	"net/http"
	"runtime"
	"sync/atomic"
	_ "embed"

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
	Source string
	Loops  []*RT
	Counter atomic.Int64
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
	r *http.Request
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

		url := *r.URL
		url.Host = r.Host
		request.Set("url", url.String())

		_, err := rt.Handler(goja.Null(), request, vm.ToValue(func(result goja.Value, err goja.Value) {
			if !goja.IsNull(err) {
				waiter<-fmt.Errorf("JavaScript exception: %v", err)
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
			waiter<-err
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
	rt := RT {
		Loop: NewEventLoop(),
		Handler: nil,
	}

	vm := rt.Loop.vm

	vm.Set("__caddy_encode", func(data string) goja.ArrayBuffer { return vm.NewArrayBuffer([]byte(data)) })
	vm.Set("__caddy_url_parse", URL.Parse)
	vm.Set("__caddy_url_parse_ref", URL.ParseRef)

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
