export function updateQuery(values: Record<string, string>, push = false) {
  const url = new URL(window.location.href);
  for (const [key, value] of Object.entries(values)) {
    if (value) url.searchParams.set(key, value);
    else url.searchParams.delete(key);
  }
  if (push) window.history.pushState(null, "", url);
  else window.history.replaceState(null, "", url);
}
