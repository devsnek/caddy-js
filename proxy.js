async function handler(request) {
  const r = await fetch(request);
  r.body = new TextDecoder().decode(r.body);
  return {
    status: 200,
    body: __caddy_encode(`hello there ${JSON.stringify(r)}`),
  };
}
