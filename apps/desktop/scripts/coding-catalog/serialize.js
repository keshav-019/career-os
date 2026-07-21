"use strict";

function serializeParam(type, value) {
  switch (type) {
    case "int":
    case "long":
    case "double":
      return `${value}\n`;
    case "string":
      return `${value}\n`;
    case "intArray":
      return value.length > 0 ? `${value.length}\n${value.join(" ")}\n` : `0\n`;
    case "stringArray":
      return `${value.length}\n` + value.map((v) => `${v}\n`).join("");
    case "grid": {
      const rows = value.length;
      const cols = rows ? value[0].length : 0;
      return `${rows} ${cols}\n` + value.map((row) => row.join(" ") + "\n").join("");
    }
    case "charGrid": {
      const rows = value.length;
      const cols = rows ? value[0].length : 0;
      return `${rows} ${cols}\n` + value.map((row) => row + "\n").join("");
    }
    case "intArrayList":
      return (
        `${value.length}\n` +
        value.map((arr) => (arr.length > 0 ? `${arr.length}\n${arr.join(" ")}\n` : `0\n`)).join("")
      );
    default:
      throw new Error(`Unsupported type: ${type}`);
  }
}

function serializeInput(paramSpec, values) {
  return paramSpec.map((p) => serializeParam(p.type, values[p.name])).join("");
}

module.exports = { serializeInput, serializeParam };
