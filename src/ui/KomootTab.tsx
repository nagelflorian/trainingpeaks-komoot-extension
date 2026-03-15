/**
 * Root component injected into the TrainingPeaks workout detail view.
 * - Planned workout → Suggested Routes (RouteCards ranked by compliance)
 * - Completed workout → Matched Komoot Activities (ActivityCards)
 */

import React, { useEffect, useState, useCallback } from "react";
import TAB_ICON_SVG from "../content/tabIcon.svg?raw";
import browser from "webextension-polyfill";
import type { WorkoutMetadata } from "../types/trainingpeaks";
import type { KomootTour } from "../types/komoot";
import type { ExtensionMessage, ExtensionResponse } from "../types/messages";
import { SPORT_TYPE_MAP } from "../types/trainingpeaks";
import { RouteCard } from "./RouteCard";
import { ActivityCard } from "./ActivityCard";

interface Props {
  workout: WorkoutMetadata;
}

type ViewState =
  | { status: "loading" }
  | { status: "auth_required" }
  | { status: "suggestions"; tours: KomootTour[] }
  | { status: "activities"; tours: KomootTour[] }
  | { status: "no_sport" }
  | { status: "empty"; isCompleted: boolean }
  | { status: "error"; message: string };

async function sendMessage(msg: ExtensionMessage): Promise<ExtensionResponse> {
  return browser.runtime.sendMessage(msg) as Promise<ExtensionResponse>;
}

export function KomootTab({ workout }: Props): React.ReactElement {
  const [state, setState] = useState<ViewState>({ status: "loading" });
  const [description, setDescription] = useState(
    () => document.getElementById("descriptionInput")?.innerText ?? "",
  );

  const komootSport = SPORT_TYPE_MAP[workout.sportType];

  const load = useCallback(async () => {
    setState({ status: "loading" });

    try {
      // Check auth first
      const authRes = await sendMessage({ type: "GET_AUTH_STATUS" });
      if (authRes.type !== "AUTH_STATUS" || !authRes.payload.loggedIn) {
        setState({ status: "auth_required" });
        return;
      }

      const userId = authRes.payload.userId ?? "";

      if (workout.isCompleted) {
        // Fetch matched activities
        const res = await sendMessage({
          type: "FETCH_MATCHED_ACTIVITIES",
          payload: { date: workout.date, userId },
        });

        if (res.type === "ERROR") {
          if (res.payload.message === "AUTH_REQUIRED") {
            setState({ status: "auth_required" });
          } else {
            setState({ status: "error", message: res.payload.message });
          }
          return;
        }

        if (res.type === "MATCHED_ACTIVITIES") {
          if (res.payload.length === 0) {
            setState({ status: "empty", isCompleted: true });
          } else {
            setState({ status: "activities", tours: res.payload });
          }
        }
      } else {
        // No route suggestions for unsupported sports
        if (komootSport === null) {
          setState({ status: "no_sport" });
          return;
        }

        const res = await sendMessage({
          type: "FETCH_SUGGESTIONS",
          payload: workout,
        });

        if (res.type === "ERROR") {
          if (res.payload.message === "AUTH_REQUIRED") {
            setState({ status: "auth_required" });
          } else {
            setState({ status: "error", message: res.payload.message });
          }
          return;
        }

        if (res.type === "SUGGESTIONS") {
          if (res.payload.length === 0) {
            setState({ status: "empty", isCompleted: false });
          } else {
            setState({ status: "suggestions", tours: res.payload });
          }
        }
      }
    } catch (err) {
      setState({
        status: "error",
        message:
          err instanceof Error ? err.message : "An unexpected error occurred",
      });
    }
  }, [workout, komootSport]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="p-4 font-sans text-sm min-h-[120px] flex">
      <div className="max-w-[620px]">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span
              className="inline-flex items-center"
              dangerouslySetInnerHTML={{ __html: TAB_ICON_SVG }}
            />
            <span className="font-bold text-base text-gray-900">Komoot</span>
            <span className="text-xs text-gray-500">
              {workout.isCompleted ? "Matched Activities" : "Suggested Routes"}
            </span>
          </div>
          <div className="flex gap-2">
            {state.status !== "loading" && state.status !== "auth_required" && (
              <button
                onClick={load}
                className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded border border-gray-200 hover:border-gray-300"
                title="Refresh"
              >
                ↻ Refresh
              </button>
            )}
            <a
              href="https://www.komoot.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:text-primary-hover px-2 py-1 rounded border border-border hover:border-border"
            >
              Open Komoot ↗
            </a>
          </div>
        </div>

        {/* Body */}
        <Body
          state={state}
          workout={workout}
          onLoginClick={openKomootLogin}
          description={description}
          onDescriptionChange={setDescription}
        />
      </div>
    </div>
  );
}

function Body({
  state,
  workout,
  onLoginClick,
  description,
  onDescriptionChange,
}: {
  state: ViewState;
  workout: WorkoutMetadata;
  onLoginClick: () => void;
  description: string;
  onDescriptionChange: (d: string) => void;
}): React.ReactElement {
  switch (state.status) {
    case "loading":
      return (
        <div className="flex items-center justify-center py-8 text-gray-400">
          <Spinner />
          <span className="ml-2">Loading…</span>
        </div>
      );

    case "auth_required":
      return (
        <div className="text-center py-6">
          <p className="text-gray-600 mb-3">
            Connect your Komoot account to see suggestions.
          </p>
          <button
            onClick={onLoginClick}
            className="bg-primary text-primary-text text-sm font-medium px-4 py-2 rounded hover:bg-primary-hover transition-colors"
          >
            Sign in to Komoot
          </button>
        </div>
      );

    case "no_sport":
      return (
        <div className="text-center py-6 text-gray-500">
          <p>
            No route suggestions available for{" "}
            <strong>{workout.sportType}</strong>.
          </p>
        </div>
      );

    case "empty":
      return (
        <div className="text-center py-6 text-gray-500">
          {state.isCompleted ? (
            <p>No Komoot activities found matching this workout date.</p>
          ) : (
            <p>
              No matching routes found. Try adjusting your home location in
              Options.
            </p>
          )}
        </div>
      );

    case "error":
      return (
        <div className="bg-red-50 border border-red-200 rounded p-3 text-red-700 text-xs">
          <strong>Error:</strong> {state.message}
        </div>
      );

    case "suggestions":
      return (
        <div>
          <p className="text-xs text-gray-500 mb-2">
            {state.tours.length} route{state.tours.length !== 1 ? "s" : ""}{" "}
            matching your planned {workout.sportType.toLowerCase()} workout.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {state.tours.map((tour) => (
              <RouteCard
                key={tour.id}
                tour={tour}
                plannedElevationM={workout.plannedElevationM}
                workoutId={workout.workoutId}
                athleteId={workout.athleteId}
                description={description}
                onDescriptionChange={onDescriptionChange}
              />
            ))}
          </div>
        </div>
      );

    case "activities":
      return (
        <div>
          <p className="text-xs text-gray-500 mb-2">
            {state.tours.length} Komoot activit
            {state.tours.length !== 1 ? "ies" : "y"} on {workout.date}
          </p>
          <div className="flex flex-col gap-2">
            {state.tours.map((tour) => (
              <ActivityCard key={tour.id} tour={tour} />
            ))}
          </div>
        </div>
      );
  }
}

function Spinner(): React.ReactElement {
  return (
    <svg
      className="animate-spin h-4 w-4 text-primary"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.37 0 0 5.37 0 12h4z"
      />
    </svg>
  );
}

function openKomootLogin(): void {
  window.open("https://www.komoot.com/login", "_blank", "noopener");
}
