export const TRANSITOUS_POLICY = {
  service: "Transitous",
  usagePolicyUrl: "https://transitous.org/api/",
  sourcesUrl: "https://transitous.org/sources/",
  openStreetMapCopyrightUrl: "https://www.openstreetmap.org/copyright",
  notice:
    "Transitous is a volunteer-run, best-effort service intended for FOSS and non-profit use. " +
    "Use a descriptive User-Agent with contact details, cache results, avoid heavy traffic, " +
    "and contact Transitous before resource-intensive or commercial use.",
  dataWarning:
    "Journey data can be incomplete or outdated and may differ from an operator's official service. " +
    "Verify important journeys with the relevant transport operator.",
} as const;

export function policyEnvelope() {
  return {
    attribution: TRANSITOUS_POLICY,
  };
}
