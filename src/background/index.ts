/**
 * Background service worker entry point.
 * Handles all message passing between content scripts and the Komoot API.
 */

import browser from "webextension-polyfill";
import { signOut, getStoredAuth, verifyAuth } from "./auth";
import {
  fetchUserActivities,
  filterActivitiesByDate,
  searchRoutes,
  rankRoutes,
  DEFAULT_WEIGHTS,
  type MatchingWeights,
  type SearchRouteOptions,
} from "./komootApi";
import type { ExtensionMessage, ExtensionResponse } from "../types/messages";

const OPTIONS_STORAGE_KEY = "komootOptions";

interface StoredOptions {
  weights: MatchingWeights;
  homeLocation?: { lat: number; lng: number };
  maxResults: number;
}

async function getOptions(): Promise<StoredOptions> {
  const result = await browser.storage.local.get(OPTIONS_STORAGE_KEY);
  return (
    (result[OPTIONS_STORAGE_KEY] as StoredOptions) ?? {
      weights: DEFAULT_WEIGHTS,
      maxResults: 5,
    }
  );
}

// ─── Message handler ──────────────────────────────────────────────────────────

browser.runtime.onMessage.addListener(
  (
    message: unknown,
    _sender: browser.Runtime.MessageSender,
  ): Promise<ExtensionResponse> => {
    const msg = message as ExtensionMessage;

    switch (msg.type) {
      case "LOGOUT":
        return handleLogout();

      case "GET_AUTH_STATUS":
        return handleGetAuthStatus();

      case "FETCH_SUGGESTIONS":
        return handleFetchSuggestions(msg);

      case "FETCH_MATCHED_ACTIVITIES":
        return handleFetchMatchedActivities(
          msg.payload.date,
          msg.payload.userId,
        );

      default:
        return Promise.resolve({
          type: "ERROR",
          payload: {
            message: `Unknown message type: ${(msg as { type: string }).type}`,
          },
        });
    }
  },
);

async function handleLogout(): Promise<ExtensionResponse> {
  await signOut();
  return { type: "AUTH_STATUS", payload: { loggedIn: false } };
}

async function handleGetAuthStatus(): Promise<ExtensionResponse> {
  try {
    const auth = await verifyAuth();
    if (auth) {
      return {
        type: "AUTH_STATUS",
        payload: {
          loggedIn: true,
          displayName: auth.displayName,
          userId: auth.userId,
        },
      };
    }
    return { type: "AUTH_STATUS", payload: { loggedIn: false } };
  } catch {
    return { type: "AUTH_STATUS", payload: { loggedIn: false } };
  }
}

async function handleFetchSuggestions(
  msg: Extract<ExtensionMessage, { type: "FETCH_SUGGESTIONS" }>,
): Promise<ExtensionResponse> {
  try {
    const auth = await getStoredAuth();
    if (!auth) return { type: "ERROR", payload: { message: "AUTH_REQUIRED" } };

    const options = await getOptions();
    const searchOptions: SearchRouteOptions = {
      sportType: msg.payload.sportType,
      centerLat: options.homeLocation?.lat,
      centerLng: options.homeLocation?.lng,
      limit: options.maxResults * 4, // fetch more candidates for ranking
    };
    if (msg.payload.plannedDistanceM) {
      searchOptions.maxDistanceKm = (msg.payload.plannedDistanceM * 1.2) / 1000;
      searchOptions.minDistanceKm = (msg.payload.plannedDistanceM * 0.8) / 1000;
    }

    const tours = await searchRoutes(searchOptions);

    const ranked = rankRoutes(
      tours,
      msg.payload,
      options.weights,
      options.maxResults,
    );
    return { type: "SUGGESTIONS", payload: ranked };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to fetch suggestions";
    if (message === "AUTH_REQUIRED") {
      return { type: "ERROR", payload: { message: "AUTH_REQUIRED" } };
    }
    if (message === "NO_HOME_LOCATION") {
      return {
        type: "ERROR",
        payload: {
          message:
            "Set your home location in Options to search for nearby routes.",
        },
      };
    }
    return { type: "ERROR", payload: { message } };
  }
}

async function handleFetchMatchedActivities(
  date: string,
  userId: string,
): Promise<ExtensionResponse> {
  try {
    const auth = await getStoredAuth();
    if (!auth) return { type: "ERROR", payload: { message: "AUTH_REQUIRED" } };

    const activities = await fetchUserActivities(userId);
    const matched = filterActivitiesByDate(activities, date);
    return { type: "MATCHED_ACTIVITIES", payload: matched };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to fetch activities";
    return { type: "ERROR", payload: { message } };
  }
}
