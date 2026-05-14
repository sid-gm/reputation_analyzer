export type NarrativeStage = "emerging" | "developing" | "peaked" | "declining";

export function computeNarrativeStage(opts: {
  velocity24h: number;      // items added in the last 24h
  prevVelocity24h: number;  // items added in the 24-48h window
  peakMomentum: number | null; // null = first classification run for this cluster
  ageInDays: number;
}): NarrativeStage {
  const { velocity24h, prevVelocity24h, peakMomentum, ageInDays } = opts;
  const acceleration = velocity24h - prevVelocity24h;

  // Very new cluster still receiving intake
  if (ageInDays < 2 && velocity24h > 0) return "emerging";

  // First-ever run: no historical peak to compare against
  if (peakMomentum == null) {
    if (velocity24h === 0) return ageInDays > 3 ? "declining" : "peaked";
    if (acceleration > 0) return "developing";
    return "developing";
  }

  const peakRatio = peakMomentum > 0 ? velocity24h / peakMomentum : 0;

  if (acceleration > 0 && peakRatio < 0.85) return "developing";
  if (peakRatio >= 0.85 && acceleration <= 0) return "peaked";
  if (peakRatio < 0.5 && acceleration <= 0) return "declining";
  if (velocity24h === 0 && ageInDays > 3) return "declining";

  return "developing";
}
