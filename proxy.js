async function handler(request) {
  return {
    status: 200,
    body: __caddy_encode(`hello there ${request.url}`),
  };
}
