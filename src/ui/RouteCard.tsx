/**
 * Displays a single suggested Komoot route for a planned workout.
 */

import React, { useState } from "react";
import type { KomootTour, KomootScoreBreakdown } from "../types/komoot";
import { ElevationChart } from "./ElevationChart";
import { formatDistance, formatDuration } from "./formatters";

interface Props {
  tour: KomootTour;
  plannedElevationM?: number;
  workoutId?: string;
  athleteId?: string;
  /** Current workout description text — used to derive attach state across all cards. */
  description: string;
  onDescriptionChange: (newDescription: string) => void;
}

const TP_API = "https://tpapi.trainingpeaks.com/fitness/v6";

// ─── TP API — called directly from content script context so TP's session
//     cookies are included (background service worker has a different origin). ──

async function updateWorkoutDescription(
  athleteId: string,
  workoutId: string,
  routeUrl: string,
  add: boolean,
): Promise<string> {
  const url = `${TP_API}/athletes/${athleteId}/workouts/${workoutId}`;

  const getRes = await fetch(url, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  if (!getRes.ok) throw new Error(`TP GET failed (${getRes.status})`);
  const workout = await getRes.json();

  const current: string = workout.description ?? "";
  // Strip any existing Komoot route line before (re-)adding so only one is present.
  const stripped = current
    .replace(/\n*Route: https:\/\/www\.komoot\.com\/[^\n]*/g, "")
    .trimEnd();
  const routeLine = `Route: ${routeUrl}`;
  const description = add
    ? stripped
      ? `${stripped}\n\n${routeLine}`
      : routeLine
    : stripped;

  const putBody = {
    ...workout,
    description,
    structure:
      workout.structure !== null && typeof workout.structure === "object"
        ? JSON.stringify(workout.structure)
        : workout.structure,
  };

  const putRes = await fetch(url, {
    method: "PUT",
    credentials: "include",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(putBody),
  });
  if (!putRes.ok) throw new Error(`TP PUT failed (${putRes.status})`);

  return description;
}

/** Sync the saved description back into TP's DOM field so it re-renders. */
function syncDescriptionToDOM(description: string): void {
  const el = document.getElementById("descriptionInput");
  if (!el) return;
  el.innerText = description;
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

// ─── Score tooltip ─────────────────────────────────────────────────────────────

function ScoreTooltip({
  breakdown,
}: {
  breakdown: KomootScoreBreakdown;
}): React.ReactElement {
  const rows: {
    label: string;
    planned: string;
    actual: string;
    pct: number;
  }[] = [];

  if (breakdown.distance) {
    rows.push({
      label: "Distance",
      planned: formatDistance(breakdown.distance.planned),
      actual: formatDistance(breakdown.distance.actual),
      pct: breakdown.distance.pct,
    });
  }
  if (breakdown.duration) {
    rows.push({
      label: "Duration",
      planned: formatDuration(breakdown.duration.planned),
      actual: formatDuration(breakdown.duration.actual),
      pct: breakdown.duration.pct,
    });
  }
  if (breakdown.elevation) {
    rows.push({
      label: "Elevation",
      planned: `${Math.round(breakdown.elevation.planned)} m`,
      actual: `${Math.round(breakdown.elevation.actual)} m`,
      pct: breakdown.elevation.pct,
    });
  }

  if (rows.length === 0) {
    return (
      <div
        className="absolute z-20 top-full left-0 mt-1 w-44 bg-white border border-gray-200 rounded-lg p-2 text-xs text-gray-500"
        style={{ boxShadow: "0 10px 30px rgba(0,0,0,0.2)" }}
      >
        No planned metrics to compare.
      </div>
    );
  }

  return (
    <div
      className="absolute z-20 top-full left-0 mt-1 w-52 bg-white border border-gray-200 rounded-lg p-2.5 text-xs"
      style={{ boxShadow: "0 10px 30px rgba(0,0,0,0.2)" }}
    >
      <p className="font-semibold text-gray-700 mb-2">Match breakdown</p>
      <table className="w-full border-collapse">
        <thead>
          <tr className="text-gray-400">
            <th className="text-left font-normal pb-1 pr-2"></th>
            <th className="text-right font-normal pb-1 pr-2">Route</th>
            <th className="text-right font-normal pb-1 pr-2">Planned</th>
            <th className="text-right font-normal pb-1">Match</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="text-gray-600">
              <td className="py-0.5 pr-2 text-gray-400">{r.label}</td>
              <td className="py-0.5 pr-2 text-right tabular-nums">
                {r.actual}
              </td>
              <td className="py-0.5 pr-2 text-right tabular-nums text-gray-400">
                {r.planned}
              </td>
              <td className="py-0.5 text-right tabular-nums font-medium text-primary">
                {r.pct}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: "bg-green-100 text-green-800",
  moderate: "bg-yellow-100 text-yellow-800",
  difficult: "bg-orange-100 text-orange-800",
  expert: "bg-red-100 text-red-800",
};

/** Resolve a (possibly templated) Komoot image URL to a usable src. */
function resolveImageSrc(tour: KomootTour): string | undefined {
  if (tour.vector_map_image?.src) return tour.vector_map_image.src;
  if (tour.vector_map_image_preview?.src)
    return tour.vector_map_image_preview.src;
  const src = tour.map_image_preview?.src ?? tour.map_image?.src;
  if (!src) return undefined;
  return src
    .replace("{width}", "1200")
    .replace("{height}", "600")
    .replace("{crop}", "false");
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function RouteCard({
  tour,
  plannedElevationM,
  workoutId,
  athleteId,
  description,
  onDescriptionChange,
}: Props): React.ReactElement {
  const [elevExpanded, setElevExpanded] = useState(false);
  const [scoreHovered, setScoreHovered] = useState(false);
  const komootUrl = `https://www.komoot.com/smarttour/${tour.id}?tour_origin=smart_tour_search`;
  const isAdded = description.includes(`Route: ${komootUrl}`);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | undefined>();
  const difficulty = tour.difficulty?.grade;
  const thumbnail = resolveImageSrc(tour);
  const canAttach = !!athleteId;

  async function handleAddRemove(): Promise<void> {
    // Resolve workout ID dynamically at click time — the prop may point to a
    // different workout if multiple panels are mounted in the TP DOM.
    const domWorkoutId =
      document
        .querySelector(".activity.workout.selected[data-workoutid]")
        ?.getAttribute("data-workoutid") ?? null;
    const activeWorkoutId = domWorkoutId ?? workoutId;
    if (!activeWorkoutId || !athleteId) return;
    setIsUpdating(true);
    setUpdateError(undefined);
    try {
      const saved = await updateWorkoutDescription(
        athleteId,
        activeWorkoutId,
        komootUrl,
        !isAdded,
      );
      syncDescriptionToDOM(saved);
      onDescriptionChange(saved);
    } catch (err) {
      setUpdateError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setIsUpdating(false);
    }
  }

  return (
    <div
      data-testid="route-card"
      className="flex flex-col border border-gray-200 rounded-lg bg-white shadow-sm hover:shadow-md transition-shadow"
      style={
        isAdded
          ? { borderColor: "var(--color-primary)", borderStyle: "solid" }
          : { borderColor: "transparent", borderStyle: "solid" }
      }
    >
      {/* Thumbnail */}
      {thumbnail && (
        <div className="relative h-36 bg-gray-100 flex-shrink-0 rounded-t-lg">
          <a
            href={komootUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block h-full"
          >
            <img
              src={thumbnail}
              alt={tour.name}
              className="w-full h-full object-cover rounded-t-lg"
              loading="lazy"
            />
          </a>
          <div className="absolute top-2 right-2 flex gap-1">
            {tour._score !== undefined && (
              <span
                data-testid="score"
                className="relative text-xs px-2 py-0.5 rounded-full font-medium bg-primary text-primary-text cursor-default"
                onMouseEnter={() => setScoreHovered(true)}
                onMouseLeave={() => setScoreHovered(false)}
              >
                {Math.round(tour._score * 100)}%
                {scoreHovered && tour._scoreBreakdown && (
                  <ScoreTooltip breakdown={tour._scoreBreakdown} />
                )}
              </span>
            )}
            {difficulty && (
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${DIFFICULTY_COLORS[difficulty] ?? "bg-gray-100 text-gray-700"}`}
              >
                {difficulty}
              </span>
            )}
          </div>
          {(tour.rating_count !== undefined && tour.rating_count > 0) ||
          (tour.visitors !== undefined && tour.visitors > 0) ? (
            <div className="absolute bottom-2 left-2 flex gap-1">
              {tour.rating_count !== undefined && tour.rating_count > 0 && (
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-medium text-white"
                  style={{ background: "rgba(0,0,0,0.5)" }}
                  title={`${tour.rating_count} ratings`}
                >
                  ★ {tour.rating_score?.toFixed(1)} ({tour.rating_count})
                </span>
              )}
              {tour.visitors !== undefined && tour.visitors > 0 && (
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-medium text-white"
                  style={{ background: "rgba(0,0,0,0.5)" }}
                  title="Visitors"
                >
                  👁 {tour.visitors.toLocaleString()}
                </span>
              )}
            </div>
          ) : null}
        </div>
      )}

      <div className="p-3 flex flex-col flex-1 bg-gray-50 rounded-b-lg">
        {/* Title */}
        <h3 className="font-semibold text-sm leading-tight mb-2 truncate">
          <a
            href={komootUrl}
            target="_blank"
            rel="noopener noreferrer"
            title={tour.name}
            className="block truncate text-gray-900 hover:text-primary transition-colors"
          >
            {tour.name}
          </a>
        </h3>

        {/* Stats row */}
        <div className="flex justify-between text-xs text-gray-600 mb-2">
          {tour.distance > 0 && (
            <span title="Distance">📏 {formatDistance(tour.distance)}</span>
          )}
          {tour.duration > 0 && (
            <span title="Duration">⏱ {formatDuration(tour.duration)}</span>
          )}
          {(tour.elevation_up > 0 || tour.elevation_down > 0) && (
            <span title="Elevation gain / descent">
              {tour.elevation_up > 0 && `↑${Math.round(tour.elevation_up)}m`}
              {tour.elevation_up > 0 && tour.elevation_down > 0 && " "}
              {tour.elevation_down > 0 &&
                `↓${Math.round(tour.elevation_down)}m`}
            </span>
          )}
        </div>

        {/* Elevation chart (collapsible) */}
        {tour.elevation?.items && tour.elevation.items.length > 1 && (
          <div className="mb-2">
            <button
              onClick={() => setElevExpanded((v) => !v)}
              className="text-xs text-gray-500 hover:text-gray-700 underline"
            >
              {elevExpanded ? "Hide elevation" : "Show elevation"}
            </button>
            {elevExpanded && (
              <div className="mt-1">
                <ElevationChart
                  data={tour.elevation.items}
                  plannedElevationM={plannedElevationM}
                />
              </div>
            )}
          </div>
        )}

        {/* Spacer pushes buttons to the bottom of every card */}
        <div className="flex-1" />

        {/* Actions */}
        {updateError && (
          <p className="text-xs text-red-600 mb-1 truncate" title={updateError}>
            {updateError}
          </p>
        )}
        <div className="flex gap-2">
          <button
            onClick={handleAddRemove}
            disabled={isUpdating || !canAttach}
            title={!canAttach ? "Workout ID not found" : undefined}
            className={`w-full text-xs font-medium rounded px-3 py-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${isAdded ? "text-primary border border-primary bg-transparent hover:bg-primary hover:text-primary-text" : "text-primary-text bg-primary hover:bg-primary-hover"}`}
          >
            {isUpdating ? "Saving…" : isAdded ? "Detach route" : "Attach route"}
          </button>
        </div>
      </div>
    </div>
  );
}
