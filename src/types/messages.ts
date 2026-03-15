/**
 * Typed message definitions for communication between
 * content scripts and the background service worker.
 */

import type { KomootTour } from "./komoot";
import type { WorkoutMetadata } from "./trainingpeaks";

// ─── Requests (content → background) ─────────────────────────────────────────

export type ExtensionMessage =
  | { type: "LOGOUT" }
  | { type: "GET_AUTH_STATUS" }
  | { type: "FETCH_SUGGESTIONS"; payload: WorkoutMetadata }
  | {
      type: "FETCH_MATCHED_ACTIVITIES";
      payload: { date: string; userId: string };
    };

// ─── Responses (background → content) ────────────────────────────────────────

export type ExtensionResponse =
  | {
      type: "AUTH_STATUS";
      payload: { loggedIn: boolean; displayName?: string; userId?: string };
    }
  | { type: "SUGGESTIONS"; payload: KomootTour[] }
  | { type: "MATCHED_ACTIVITIES"; payload: KomootTour[] }
  | { type: "ERROR"; payload: { message: string } };
