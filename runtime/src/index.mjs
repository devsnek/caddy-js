import "./console.mjs";
import "./encoding.mjs";
import "./url.mjs";
import "./fetch.mjs";

function __caddy_handle_request(rawRequest, callback) {
  try {
    const request = new Request(rawRequest.url, rawRequest);
    Promise.resolve(handler(request))
      .then(async (response) => {
        if (!(response instanceof Response)) {
          throw new Error("handler must return an instance of Response");
        }
        const headers = {};
        response.headers.forEach((k, v) => {
          headers[k] = v;
        });
        const result = {
          status: response.status,
          headers,
          body: response.body ? await response.arrayBuffer() : null,
        };
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
