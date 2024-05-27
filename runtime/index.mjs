function __caddy_handle_request(request, callback) {
  Promise.resolve(handler(request))
    .then((result) => {
      callback(result, null);
    })
    .catch((error) => {
      callback(null, error);
    });
}

globalThis.__caddy_handle_request = __caddy_handle_request;
