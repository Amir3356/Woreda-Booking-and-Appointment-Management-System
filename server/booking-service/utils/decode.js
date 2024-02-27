// Go encoding/json type checks. The Go controllers decoded bodies into typed structs: a value of the
// wrong JSON type was a 400 "malformed JSON body: json: cannot unmarshal <kind> into Go struct field
// <Struct>.<field> of type <T>", while null or a missing field left the zero value.
import { BadRequestError } from "./errors.js";

const jsonKind = (v) =>
  typeof v === "string" ? "string" : typeof v === "number" ? "number" : typeof v === "boolean" ? "bool" : Array.isArray(v) ? "array" : "object";

function mismatch(struct, field, value, type) {
  const what = typeof value === "number" ? `number ${value}` : jsonKind(value);
  return new BadRequestError(`malformed JSON body: json: cannot unmarshal ${what} into Go struct field ${struct}.${field} of type ${type}`);
}

/**
 * Decodes body fields like Go's json.Decoder into a struct. spec: {field: type} where type is
 * "string", "*string" (null stays null), "int", "[]string" (null stays null), or a named string type
 * such as "model.QueueStatus".
 */
export function decode(input, struct, spec) {
  const out = {};
  for (const [field, type] of Object.entries(spec)) {
    const v = input[field];
    const pointer = type.startsWith("*");
    if (v === undefined || v === null) {
      out[field] = pointer || type.startsWith("[]") ? null : type === "int" ? 0 : "";
      continue;
    }
    if (type === "int") {
      if (typeof v !== "number" || !Number.isInteger(v)) throw mismatch(struct, field, v, "int");
      out[field] = v;
    } else if (type === "[]string") {
      if (!Array.isArray(v)) throw mismatch(struct, field, v, "[]string");
      out[field] = v.map((e) => {
        if (e === null) return "";
        if (typeof e !== "string") throw mismatch(struct, field, e, "string");
        return e;
      });
    } else {
      const name = pointer ? type.slice(1) : type;
      if (typeof v !== "string") throw mismatch(struct, field, v, name);
      out[field] = v;
    }
  }
  return out;
}

export const decodeSchedule = (input) =>
  decode(input, "ScheduleInput", {
    departmentId: "string", serviceId: "*string", workingDays: "[]string", openingTime: "string",
    closingTime: "string", dailyCapacity: "int", effectiveStartDate: "string", effectiveEndDate: "*string",
    status: "string",
  });
export const decodeCheckIn = (input) =>
  decode(input, "CheckInRequest", { appointmentId: "string", verifiedDocuments: "[]string", notes: "string" });
export const decodeCallNext = (input) => decode(input, "CallNextRequest", { counterNumber: "int" });
export const decodeFinalize = (input) => decode(input, "FinalizeRequest", { status: "model.QueueStatus" });
