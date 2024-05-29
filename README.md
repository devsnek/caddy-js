# caddy-js

This plugin allows you to run JavaScript within your proxy logic.


## Example

A server which responds "website with js"

```Caddyfile
# Caddyfile
:80 {
  route / {
    js "./proxy.js"
  }
  respond "website"
}
```

```js
// proxy.js
async function handler(request) {
  const res = await fetch(request);
  const body = await res.text();
  return new Response(`${body} with js`, res);
}
```
