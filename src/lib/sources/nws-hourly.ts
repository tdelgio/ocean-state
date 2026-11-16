export const NWS_API_URL = "https://api.weather.gov";
export const NWS_FETCH_TIMEOUT_MS = 4500;

export function fetchNwsHourlyUrl(value: unknown) {
  if (typeof value !== "string" || !URL.canParse(value)) {
    throw new Error("NWS point response did not include a valid hourly forecast URL");
  }

  const url = new URL(value);
  if (
    url.origin !== NWS_API_URL ||
    url.username ||
    url.password ||
    !/^\/gridpoints\/[A-Z]{3}\/\d+,\d+\/forecast\/hourly$/.test(url.pathname)
  ) {
    throw new Error("NWS point response did not include a valid hourly forecast URL");
  }

  return fetch(`${NWS_API_URL}${url.pathname}`, {
    headers: { Accept: "application/geo+json" },
    next: { revalidate: 900 },
    redirect: "error",
    signal: AbortSignal.timeout(NWS_FETCH_TIMEOUT_MS),
  });
}
