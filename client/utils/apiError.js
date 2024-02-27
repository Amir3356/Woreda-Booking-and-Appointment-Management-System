// Turns an API error into a message an administrator can act on.
export function describeError(err, action) {
  if (err?.status === 401 || err?.status === 403) {
    return `Could not ${action}: your administrator session is not connected to the server. Sign out, then sign in again with your administrator account.`;
  }
  if (err?.status === 409) {
    return `Could not ${action}: ${err.message.replace(/^conflict:\s*/i, "")}.`;
  }
  if (err?.status === 422 && err.details?.length) {
    return `Could not ${action}: ${err.details.map((d) => d.issue).join(" ")}`;
  }
  if (err instanceof TypeError) {
    return `Could not ${action}: the server is unreachable. Check that the backend is running.`;
  }
  return `Could not ${action}: ${err?.message || "unexpected server error"}.`;
}
