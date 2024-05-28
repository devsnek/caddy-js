function formatValue(v) {
  if (typeof v === "object" && v !== null) {
    const tag = Object.prototype.toString.call(v);
    if (tag === "[object RegExp]" || tag === "[object Date]") {
      return String(v);
    }

    let output = "";
    if (Array.isArray(v) || ArrayBuffer.isView(v) || v instanceof ArrayBuffer) {
      if (ArrayBuffer.isView(v) || v instanceof ArrayBuffer) {
        output += `${v.constructor.name} `;
      }
      output += "[";
      for (let i = 0; i < v.length; i += 1) {
        output += formatValue(v[i]);
        output += ", ";
      }
      output += "]";
    } else {
      output += "{";
      for (const k in v) {
        output += k;
        output += ": ";
        output += formatValue(k[v]);
        output += ", ";
      }
      output += "}";
    }

    return output;
  }

  return String(v);
}

function format(data) {
  return data.map((v) => formatValue(v)).join(" ");
}

class Console {
  debug(...args) {
    __caddy_log("debug", format(args));
  }

  log(...args) {
    __caddy_log("info", format(args));
  }

  info(...args) {
    __caddy_log("info", format(args));
  }

  warn(...args) {
    __caddy_log("warn", format(args));
  }

  error(...args) {
    __caddy_log("error", format(args));
  }

  trace(...args) {
    const stack = new Error().stack;
    const extra = stack.slice(stack.indexOf("\n", stack.indexOf("\n") + 1));
    __caddy_log("info", format(args) + extra);
  }
}

globalThis.console = new Console();
