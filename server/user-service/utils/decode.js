// Go-style JSON struct decoding (encoding/json semantics) and UTF-8 length, as the Go service used.
import { BadRequestError } from "./errors.js";

/** Length in UTF-8 bytes (Go's len(string)). */
export const byteLen = (s) => Buffer.byteLength(s, "utf8");

function jsonKind(v) {
  if (typeof v === "number") return "number";
  if (typeof v === "string") return "string";
  if (typeof v === "boolean") return "bool";
  if (Array.isArray(v)) return "array";
  return "object";
}

/**
 * Decodes a JSON object into a Go struct shape: absent or null fields get the zero value,
 * unknown fields are ignored, and a type mismatch is a 400 with encoding/json's message.
 * spec: { field: "string" | "bool" | "int" }
 */
export function decodeStruct(input, structName, spec) {
  const out = {};
  for (const [field, type] of Object.entries(spec)) {
    const v = input[field];
    if (v === undefined || v === null) {
      out[field] = type === "string" ? "" : type === "bool" ? false : 0;
      continue;
    }
    let good = false;
    let kind = jsonKind(v);
    if (type === "string") good = typeof v === "string";
    else if (type === "bool") good = typeof v === "boolean";
    else if (type === "int") {
      good = typeof v === "number" && Number.isInteger(v) && Math.abs(v) <= Number.MAX_SAFE_INTEGER;
      if (typeof v === "number" && !good) kind = `number ${v}`;
    }
    if (!good) {
      throw new BadRequestError(
        `malformed JSON body: json: cannot unmarshal ${kind} into Go struct field ${structName}.${field} of type ${type}`,
      );
    }
    out[field] = v;
  }
  return out;
}
