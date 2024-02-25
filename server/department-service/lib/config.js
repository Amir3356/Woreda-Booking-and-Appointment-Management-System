/** Environment variable or fallback (empty counts as unset). */
export const env = (key, fallback = "") => {
  const v = process.env[key];
  return v === undefined || v === "" ? fallback : v;
};
