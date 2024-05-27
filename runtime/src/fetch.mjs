async function fetch(init, opts) {
  return new Promise((resolve, reject) => {
    __caddy_fetch(init.method, init.url, init.headers || {}, init.body || null, (r, e) => {
      if (e) {
        reject(e);
      } else {
        resolve(r);
      }
    })
  });
}

globalThis.fetch = fetch;
