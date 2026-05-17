export type NarrativeStage = "emerging" | "relaxed" | "developing" | "peaked" | "declining";

// Platforms considered "news" — excluded from non-news count
export const NEWS_PLATFORMS = ["google_news", "google_alerts"];

export function computeNarrativeStage(opts: {
  velocity24h: number;
  prevVelocity24h: number;
  peakMomentum: number | null;
  ageInDays: number;
  platformCount?: number;
  nonNewsPlatformCount?: number;
}): NarrativeStage {
  const { velocity24h, prevVelocity24h, peakMomentum, ageInDays,
          platformCount = 0, nonNewsPlatformCount = 0 } = opts;
  const acceleration = velocity24h - prevVelocity24h;

  if (ageInDays < 1) {
    if (nonNewsPlatformCount >= 3 || platformCount >= 5) return "emerging";
    return "relaxed";
  }

  if (velocity24h > 0) return "developing";

  if (peakMomentum != null && peakMomentum > 0) {
    const peakRatio = velocity24h / peakMomentum;
    if (peakRatio >= 0.85 && acceleration <= 0) return "peaked";
    if (peakRatio < 0.5 && acceleration <= 0) return "declining";
  }

  if (velocity24h === 0 && ageInDays > 3) return "declining";

  return "developing";
}
