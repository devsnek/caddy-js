async function handler(request) {
  const r = await fetch(request);
  r.body = __caddy_decode(r.body);
  return {
    status: 200,
    body: __caddy_encode(`hello there ${JSON.stringify(r)}`),
  };
}
