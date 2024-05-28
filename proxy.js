async function handler(request) {
  const r = await fetch(request);
  const text = await r.text();
  return new Response(`hello there ${text}`, { status: 200 });
}
