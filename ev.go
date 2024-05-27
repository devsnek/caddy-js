package caddyjs

import (
	"github.com/dop251/goja"
)

type VM = *goja.Runtime

type EventLoop struct {
	vm       VM
	jobs     chan func(*goja.Runtime)
	stop     chan int
	AsyncCtx *AsyncContextTracker
}

func NewEventLoop() *EventLoop {
	loop := EventLoop{
		vm:       goja.New(),
		jobs:     make(chan func(VM)),
		stop:     make(chan int),
		AsyncCtx: &AsyncContextTracker{},
	}

	loop.vm.SetAsyncContextTracker(loop.AsyncCtx)

	go loop.Run()

	return &loop
}

func (loop *EventLoop) Run() {
	for true {
		select {
		case <-loop.stop:
			return
		case job := <-loop.jobs:
			job(loop.vm)
		}
	}
}

func (loop *EventLoop) Stop() {
	loop.vm.Interrupt("EventLoop::Stop")
	close(loop.stop)
}

func (loop *EventLoop) Queue(f func(VM)) {
	loop.jobs <- f
}

type AsyncContextTracker struct {
	stack []interface{}
}

func (c *AsyncContextTracker) Grab() interface{} {
	if len(c.stack) == 0 {
		return nil
	}
	return c.stack[len(c.stack)-1]
}

func (c *AsyncContextTracker) Resumed(ctx interface{}) {
	c.stack = append(c.stack, ctx)
}

func (c *AsyncContextTracker) Exited() {
	c.stack = c.stack[:len(c.stack)-1]
}
