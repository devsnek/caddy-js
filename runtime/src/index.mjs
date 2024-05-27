import './fetch.mjs';

function __caddy_handle_request(request, callback) {
  try {
    Promise.resolve(handler(request))
      .then((result) => {
        callback(result, null);
      })
      .catch((error) => {
        callback(null, error);
      });
  } catch (error) {
    callback(null, error);
  }
}

globalThis.__caddy_handle_request = __caddy_handle_request;
