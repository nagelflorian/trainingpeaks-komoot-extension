/**
 * Extracts workout metadata from the TrainingPeaks quick-view panel DOM.
 *
 * Verified selectors (from DevTools inspection):
 *  - Sport type:   .workoutBarView .workout  → second className e.g. "workout Run"
 *  - Completion:   .workoutComplianceStatus.completed vs .planned
 *  - Stats text:   .workoutComplianceStatus textContent → "0:38:11 9.00 km 84 TSS Run"
 *  - Date:         .dateAndTime > span textContent → "Friday 27 February, 2026"
 */

import type { WorkoutMetadata, SportType } from "../types/trainingpeaks";

// Maps TP's DOM sport class to our SportType
const TP_SPORT_CLASS_MAP: Record<string, SportType> = {
  Run: "Running",
  Bike: "Cycling",
  Swim: "Swimming",
  MTB: "MountainBike",
  Gravel: "GravelCycling",
  Hike: "Hiking",
  Walk: "Walking",
  Trail: "TrailRunning",
  Row: "Rowing",
  Strength: "Strength",
  Triathlon: "Triathlon",
  // TP may use lowercase too
  run: "Running",
  bike: "Cycling",
  swim: "Swimming",
  hike: "Hiking",
  walk: "Walking",
  row: "Rowing",
  strength: "Strength",
  triathlon: "Triathlon",
};

const MONTHS: Record<string, number> = {
  January: 1,
  February: 2,
  March: 3,
  April: 4,
  May: 5,
  June: 6,
  July: 7,
  August: 8,
  September: 9,
  October: 10,
  November: 11,
  December: 12,
};

/** Parse "Friday 27 February, 2026" or "27 February" → "YYYY-MM-DD" */
function parseDateText(text: string): string | undefined {
  const m = text.match(
    /(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)(?:[,\s]+(\d{4}))?/i,
  );
  if (!m) return undefined;

  const day = parseInt(m[1], 10);
  const month =
    MONTHS[m[2]] ??
    MONTHS[m[2].charAt(0).toUpperCase() + m[2].slice(1).toLowerCase()];
  const year = m[3] ? parseInt(m[3], 10) : new Date().getFullYear();

  if (!month) return undefined;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Parse duration string "H:MM:SS" or "M:SS" → seconds */
function parseDuration(text: string): number | undefined {
  const m = text.match(/\b(\d+):(\d{2}):(\d{2})\b/);
  if (m) return parseInt(m[1]) * 3600 + parseInt(m[2]) * 60 + parseInt(m[3]);
  const m2 = text.match(/\b(\d+):(\d{2})\b/);
  if (m2) return parseInt(m2[1]) * 60 + parseInt(m2[2]);
  return undefined;
}

/** Parse distance "9.00 km" or "5.6 mi" → meters */
function parseDistance(text: string): number | undefined {
  const km = text.match(/([\d.]+)\s*km\b/i);
  if (km) return parseFloat(km[1]) * 1000;
  const mi = text.match(/([\d.]+)\s*mi\b/i);
  if (mi) return parseFloat(mi[1]) * 1609.34;
  return undefined;
}

/** Parse elevation "↑ 450 m" or "1476 ft" → meters */
function parseElevation(text: string): number | undefined {
  const ft = text.match(/([\d,]+)\s*ft\b/i);
  if (ft) return parseFloat(ft[1].replace(",", "")) * 0.3048;
  const m = text.match(/([\d,]+)\s*m\b/i);
  if (m) return parseFloat(m[1].replace(",", ""));
  return undefined;
}

export function parseWorkout(panel: Element): WorkoutMetadata {
  // ── Sport type ─────────────────────────────────────────────────────────────
  // .workoutBarView .workout has classes like "workout Run" or "workout Bike"
  const workoutEl = panel.querySelector(".workoutBarView .workout");
  const sportClass = workoutEl
    ? [...workoutEl.classList].find(
        (c) => c !== "workout" && c !== "workoutNew",
      )
    : undefined;
  const sportType: SportType =
    (sportClass ? TP_SPORT_CLASS_MAP[sportClass] : undefined) ?? "Other";

  // ── Completion status ──────────────────────────────────────────────────────
  const complianceEl = panel.querySelector(
    ".workoutComplianceStatus .keyStats",
  );
  const isCompleted = complianceEl?.classList.contains("completed") ?? false;

  // ── Stats from compliance text ─────────────────────────────────────────────
  // Text format: "0:38:11 9.00 km 84 TSS Run" (spaces may be collapsed)
  // const statsText = complianceEl?.textContent ?? "";
  const plannedDurationSec = parseDuration(
    complianceEl?.querySelector(".duration")?.textContent ?? "",
  ); // parseDuration(statsText);
  const plannedDistanceM = parseDistance(
    complianceEl?.querySelector(".distance")?.textContent ?? "",
  );
  const plannedElevationM = parseElevation(
    complianceEl?.querySelector(".elevation")?.textContent ?? "",
  );

  // ── Date ───────────────────────────────────────────────────────────────────
  // .dateAndTime > span contains "Friday 27 February, 2026"
  const dateSpan = panel.querySelector(".dateAndTime span");
  const dateText = dateSpan?.textContent ?? "";
  const date = parseDateText(dateText) ?? new Date().toISOString().slice(0, 10);

  // ── Title ──────────────────────────────────────────────────────────────────
  const title =
    (panel.querySelector(".workoutTitle") as HTMLInputElement)?.value?.trim() ??
    panel
      .querySelector(".QVHeaderItemsContain")
      ?.textContent?.trim()
      .slice(0, 60);

  // ── Workout ID ─────────────────────────────────────────────────────────────
  // The selected calendar item carries the correct workout id.
  const workoutId =
    panel.getAttribute("data-workoutid") ??
    panel.querySelector("[data-workoutid]")?.getAttribute("data-workoutid") ??
    panel.closest("[data-workoutid]")?.getAttribute("data-workoutid") ??
    document
      .querySelector(".activity.workout.selected[data-workoutid]")
      ?.getAttribute("data-workoutid") ??
    undefined;

  // ── Athlete ID ─────────────────────────────────────────────────────────────
  // Stored in localStorage as ajs_user_id (may be JSON-encoded string)
  let athleteId: string | undefined;
  try {
    const raw = localStorage.getItem("ajs_user_id");
    if (raw) athleteId = raw.replace(/^"|"$/g, ""); // strip surrounding quotes if JSON string
  } catch {
    // localStorage may be unavailable in some contexts
  }

  return {
    sportType,
    date,
    plannedDurationSec,
    plannedDistanceM,
    plannedElevationM,
    isCompleted,
    title,
    workoutId: workoutId ?? undefined,
    athleteId,
  };
}
