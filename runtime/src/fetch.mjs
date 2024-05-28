class Headers {
  #headers;
  #guard;

  constructor(init = undefined) {
    this.#guard = "none";
    this.#headers = {};
  }

  append(name, value) {
    this.#headers[name] = value;
  }

  has(name, value) {
    if (value) {
      return this.#headers[name] === value;
    }
    return this.#headers[name] != null;
  }

  set(name, value) {
    this.#headers[name] = value;
  }

  getSetCookie() {
    return [];
  }

  get(name) {
    return this.#headers[name];
  }

  getAll(name) {
    return this.#headers[name];
  }

  delete(name, value) {
    delete this.#headers[name];
  }

  keys() {
    return Object.keys(this.#headers)[Symbol.iterator]();
  }

  entries() {
    return Object.entries(this.#headers)[Symbol.iterator]();
  }

  forEach(cb, thisArg = undefined) {
    for (const name of this.keys()) {
      Reflect.apply(callback, thisArg, [this.get(name), name, this]);
    }
  }

  [Symbol.iterator]() {
    return this.entries();
  }
}

const ENCODER = new TextEncoder();
const DECODER = new TextDecoder();

class Body {
  #disturbed = false;
  #body = null;
  #stream = null;
  #error;

  constructor(body) {
    if (body == null) {
      //} else if (body instanceof ReadableStream) {
      //  this.#body = body;
      //  this.#stream = body;
    } else if (body instanceof ArrayBuffer) {
      this.#body = new Uint8Array(body);
    } else if (body instanceof Uint8Array) {
      this.#body = body;
    } else {
      this.#body = ENCODER.encode(String(body));
    }
  }

  get body() {
    if (this.#stream == null && this.#body != null) {
      /*
      this.#stream = new ReadableStream({
        start(controller) {
          controller.enqueue(this.#body);
          controller.close();
        },
      });
      */
      this.#stream = this.#body;
    }
    return this.#stream;
  }

  get bodyUsed() {
    return this.#disturbed;
  }

  async arrayBuffer() {
    const ta = await this.#consume();
    return ta.buffer.slice(ta.byteOffset, ta.byteOffset + ta.byteLength);
  }

  async formData() {}

  async blob() {}

  async json() {
    const text = await this.text();
    return JSON.parse(text);
  }

  async text() {
    const ta = await this.#consume();
    return DECODER.decode(ta);
  }

  async #consume() {
    if (this.#disturbed) {
      throw new TypeError("body has already been consumed");
    }
    this.#disturbed = true;

    if (this.#error) {
      throw this.#error;
    }

    if (this.#body == null) {
      return new Uint8Array();
    }

    if (this.#body instanceof Uint8Array) {
      return this.#body;
    }

    let total = 0;
    const chunks = [];
    for await (const chunk of this.#body) {
      chunks.push(chunk);
      total += chunk.length;
    }

    const output = new Uint8Array(total);
    let offset = 0;
    for (let i = 0; i < chunks.length; i += 1) {
      output.set(chunks[i], offset);
      offset += chunks[i].length;
    }

    return output;
  }
}

Object.defineProperties(Body.prototype, {
  body: { enumerable: true },
  bodyUsed: { enumerable: true },
  arrayBuffer: { enumerable: true },
  blob: { enumerable: true },
  json: { enumerable: true },
  text: { enumerable: true },
});

const ReferrerPolicy = new Set([
  "",
  "no-referrer",
  "no-referrer-when-downgrade",
  "same-origin",
  "origin",
  "strict-origin",
  "origin-when-cross-origin",
  "strict-origin-when-cross-origin",
  "unsafe-url",
]);

function validateReferrerPolicy(referrerPolicy) {
  if (!ReferrerPolicy.has(referrerPolicy)) {
    throw new TypeError(`Invalid referrerPolicy: ${referrerPolicy}`);
  }

  return referrerPolicy;
}

const isRequest = (v) => v instanceof Request;

class Request extends Body {
  #url;
  #method;
  #redirect;
  #headers;
  #signal;
  #referrer;
  #referrerPolicy;

  constructor(input, init = {}) {
    let parsedURL;
    if (isRequest(input)) {
      parsedURL = new URL(input.url);
    } else {
      parsedURL = new URL(input);
      input = {};
    }

    if (parsedURL.username || parsedURL.password) {
      throw new TypeError("URL cannot have credentials");
    }

    let method = init.method || input.method || "GET";
    if (/^(delete|get|head|options|post|put)$/i.test(method)) {
      method = method.toUpperCase();
    }

    if (
      (init.body != null || (isRequest(input) && input.body !== null)) &&
      (method === "GET" || method === "HEAD")
    ) {
      throw new TypeError(`Request with GET/HEAD method cannot have body`);
    }

    const inputBody = init.body
      ? init.body
      : isRequest(input) && input.body !== null
        ? clone(input)
        : null;

    super(inputBody);

    const headers = new Headers(init.headers || input.headers || {});

    /*
    if (inputBody !== null && !headers.has("Content-Type")) {
      const contentType = extractContentType(inputBody, this);
      if (contentType) {
        headers.set("Content-Type", contentType);
      }
    }
    */

    let signal = isRequest(input) ? input.signal : null;
    if ("signal" in init) {
      signal = init.signal;
    }

    if (signal != null && !isAbortSignal(signal)) {
      throw new TypeError(
        "Expected signal to be an instanceof AbortSignal or EventTarget",
      );
    }

    let referrer = init.referrer == null ? input.referrer : init.referrer;
    if (referrer === "") {
      referrer = "no-referrer";
    } else if (referrer) {
      const parsedReferrer = new URL(referrer);
      referrer = /^about:(\/\/)?client$/.test(parsedReferrer)
        ? "client"
        : parsedReferrer;
    } else {
      referrer = undefined;
    }

    this.#url = parsedURL;
    this.#method = method;
    this.#redirect = init.redirect || input.redirect || "follow";
    this.#headers = headers;
    this.#signal = signal;
    this.#referrer = referrer;
    this.#referrerPolicy = validateReferrerPolicy(
      init.referrerPolicy || input.referrerPolicy || "",
    );
  }

  get method() {
    return this.#method;
  }

  get url() {
    return this.#url.href;
  }

  get headers() {
    return this.#headers;
  }

  get redirect() {
    return this.#redirect;
  }

  get signal() {
    return this.#signal;
  }

  get referrer() {
    if (this.#referrer === "no-referrer") {
      return "";
    }

    if (this.#referrer === "client") {
      return "about:client";
    }

    if (this.#referrer) {
      return this.#referrer.toString();
    }

    return undefined;
  }

  get referrerPolicy() {
    return this.#referrerPolicy;
  }

  set referrerPolicy(referrerPolicy) {
    this.#referrerPolicy = validateReferrerPolicy(referrerPolicy);
  }

  clone() {
    return new Request(this);
  }

  get [Symbol.toStringTag]() {
    return "Request";
  }
}

Object.defineProperties(Request.prototype, {
  method: { enumerable: true },
  url: { enumerable: true },
  headers: { enumerable: true },
  redirect: { enumerable: true },
  clone: { enumerable: true },
  signal: { enumerable: true },
  referrer: { enumerable: true },
  referrerPolicy: { enumerable: true },
});

class Response extends Body {
  #type;
  #url;
  #status;
  #statusText;
  #headers;

  constructor(body = null, options = {}) {
    super(body);

    const headers = new Headers(options.headers);
    /*
    if (body !== null && !headers.has("Content-Type")) {
      const contentType = extractContentType(body, this);
      if (contentType) {
        headers.append("Content-Type", contentType);
      }
    }
    */
    this.#type = "default";
    this.#url = options.url;
    this.#status = options.status != null ? options.status : 200;
    this.#statusText = options.statusText || "";
    this.#headers = headers;
  }

  get type() {
    return this.#type;
  }

  get url() {
    return this.#url;
  }

  get status() {
    return this.#status;
  }

  get ok() {
    return this.#status >= 200 && this.#status < 300;
  }

  get redirected() {
    return false;
  }

  get statusText() {
    return this.#statusText;
  }

  get headers() {
    return this.#headers;
  }

  static error() {
    const response = new Response(null, { status: 0, statusText: "" });
    response.#type = "error";
    return response;
  }

  static json(data = undefined, init = {}) {
    const body = JSON.stringify(data);

    if (body === undefined) {
      throw new TypeError("data is not JSON serializable");
    }

    const headers = new Headers(init?.headers);

    if (!headers.has("content-type")) {
      headers.set("content-type", "application/json");
    }

    return new Response(body, {
      ...init,
      headers,
    });
  }

  get [Symbol.toStringTag]() {
    return "Response";
  }
}

Object.defineProperties(Response.prototype, {
  type: { enumerable: true },
  url: { enumerable: true },
  status: { enumerable: true },
  ok: { enumerable: true },
  redirected: { enumerable: true },
  statusText: { enumerable: true },
  headers: { enumerable: true },
  // clone: {enumerable: true},
});

async function fetch(init, opts) {
  const request = new Request(init, opts);

  const data = await new Promise((resolve, reject) => {
    const headers = {};
    request.headers.forEach((k, v) => {
      headers[k] = v;
    });
    __caddy_fetch(request.method, request.url, headers, null, (r, e) => {
      if (e) {
        reject(e);
      } else {
        resolve(r);
      }
    });
  });

  return new Response(data.body, data);
}

globalThis.Request = Request;
globalThis.Response = Response;
globalThis.Headers = Headers;
globalThis.fetch = fetch;
