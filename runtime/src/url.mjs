class URLSearchParams {
  #params;

  constructor(init) {
    if (init === null && arguments[1] !== null) {
      this.#params = arguments[1];
    } else if (Array.isArray(init)) {
      this.#params = __caddy_url_parse("http://x/").SearchParams();
      for (const pair of init) {
        if (pair.length !== 2) {
          throw new TypeError(
            "Failed to construct 'URLSearchParams': parameter 1 sequence's element does not " +
              "contain exactly two elements.",
          );
        }
        this.#params.Append(pair[0], pair[1]);
      }
    } else if (typeof init === "object") {
      this.#params = __caddy_url_parse("http://x/").SearchParams();
      for (const name of Object.keys(init)) {
        const value = init[name];
        this.#params.Append(pair[0], pair[1]);
      }
    } else {
      if (typeof init === "string" && init[0] === "?") {
        init = init.slice(1);
      }
      this.#params = __caddy_url_parse(`http://x/?${init}`).SearchParams();
    }
  }

  append(key, value) {
    this.#params.Append(key, value);
  }

  delete(key, value) {
    this.#params.Delete(key);
  }

  forEach(f, thisArg = undefined) {
    this.#params.Iterate((kv) => {
      f.apply(thisArg, kv.Value, kv.Name, this);
    });
  }

  get(key) {
    return this.#params.Get(key);
  }

  getAll(key) {
    return this.#params.GetAll(key);
  }

  has(key, value) {
    return this.#params.Has(key);
  }

  set(key, value) {
    this.#params.Set(key, value);
  }

  sort() {
    this.#params.Sort();
  }

  toString() {
    return this.#params.String();
  }

  entries() {
    const result = [];
    this.forEach((v, k) => {
      result.push([k, v]);
    });
    return result[Symbol.iterator]();
  }

  keys() {
    const result = [];
    this.forEach((v, k) => {
      result.push(k);
    });
    return result[Symbol.iterator]();
  }

  values() {
    const result = [];
    this.forEach((v) => {
      result.push(v);
    });
    return result[Symbol.iterator]();
  }
}

class URL {
  #url;

  constructor(url, base) {
    if (base) {
      this.#url = __caddy_url_parse_ref(url, base);
    } else {
      this.#url = __caddy_url_parse(url);
    }
  }

  static canParse(url, base) {
    try {
      new URL(url, base);
      return true;
    } catch {
      return false;
    }
  }

  get href() {
    return this.#url.Href();
  }

  set href(v) {
    this.#url = __caddy_url_parse(v);
  }

  get origin() {
    return `${this.protocol}//${this.host}`;
  }

  get protocol() {
    return this.#url.Protocol();
  }

  set protocol(v) {
    this.#url.SetProtocol(v);
  }

  get username() {
    return this.#url.Username();
  }

  set username(v) {
    this.#url.SetUsername(v);
  }

  get password() {
    return this.#url.Password();
  }

  set password(v) {
    this.#url.SetPassword(v);
  }

  get host() {
    return this.#url.Host();
  }

  set host(v) {
    this.#url.SetHost(v);
  }

  get hostname() {
    return this.#url.Hostname();
  }

  set hostname(v) {
    this.#url.SetHostname(v);
  }

  get port() {
    return this.#url.Port();
  }

  set port(v) {
    this.#url.SetPort(v);
  }

  get pathname() {
    return this.#url.Pathname();
  }

  set pathname(v) {
    this.#url.SetPathname(v);
  }

  get search() {
    return this.#url.Search();
  }

  set search(v) {
    this.#url.SetSearch(v);
  }

  get searchParams() {
    return new URLSearchParams(null, this.#url.SearchParams());
  }

  get hash() {
    return this.#url.Hash();
  }

  set hash(v) {
    this.#url.SetHash(v);
  }

  toJSON() {
    return this.href;
  }
}

globalThis.URLSearch = URLSearchParams;
globalThis.URL = URL;
