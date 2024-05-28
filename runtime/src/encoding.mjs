class TextEncoder {
  get encoding() {
    return "utf-8";
  }

  encode(string) {
    return new Uint8Array(__caddy_encode(string));
  }
}

class TextDecoder {
  #label;
  #options;

  constructor(label = "utf-8", options = {}) {
    this.#label = label;
    this.#options = options;
  }

  decode(data) {
    return __caddy_decode(data);
  }
}

globalThis.TextEncoder = TextEncoder;
globalThis.TextDecoder = TextDecoder;
