async function handler(request) {
  const r = await new Promise((resolve, reject) => {
    __caddy_fetch(request.method, request.url, request.headers, null, (r, e) => {
      if (e) {
        reject(e);
      } else {
        resolve(r);
      }
    });
  });
  r.body = __caddy_decode(r.body);
  return {
    status: 200,
    body: __caddy_encode(`hello there ${JSON.stringify(r)}`),
  };
}
