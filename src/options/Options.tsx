/**
 * Extension options page.
 * - Matching priority (drag-to-reorder or button-based reorder)
 * - Home location (city/lat,lon for route search center)
 * - Max results (3 / 5 / 10)
 */

import React, { useEffect, useState } from "react";
import browser from "webextension-polyfill";
import type { MatchingWeights } from "../background/komootApi";

const OPTIONS_STORAGE_KEY = "komootOptions";

interface Options {
  weights: MatchingWeights;
  homeLocation?: { lat: number; lng: number; label?: string };
  maxResults: 3 | 5 | 10;
}

const DEFAULT_OPTIONS: Options = {
  weights: { duration: 0.5, distance: 0.35, elevation: 0.15 },
  maxResults: 5,
};

type PriorityKey = keyof MatchingWeights;

const PRIORITY_LABELS: Record<PriorityKey, string> = {
  duration: "Duration",
  distance: "Distance",
  elevation: "Elevation",
};

function weightsToOrder(w: MatchingWeights): PriorityKey[] {
  return (Object.keys(w) as PriorityKey[]).sort((a, b) => w[b] - w[a]);
}

const WEIGHT_VALUES: Record<number, MatchingWeights> = {
  0: { duration: 0.5, distance: 0.35, elevation: 0.15 },
  1: { distance: 0.5, duration: 0.35, elevation: 0.15 },
  2: { elevation: 0.5, duration: 0.35, distance: 0.15 },
  3: { distance: 0.5, elevation: 0.35, duration: 0.15 },
  4: { duration: 0.5, elevation: 0.35, distance: 0.15 },
  5: { elevation: 0.5, distance: 0.35, duration: 0.15 },
};

const ORDER_TO_INDEX: Record<string, number> = {
  "duration,distance,elevation": 0,
  "distance,duration,elevation": 1,
  "elevation,duration,distance": 2,
  "distance,elevation,duration": 3,
  "duration,elevation,distance": 4,
  "elevation,distance,duration": 5,
};

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Reverse geocoding failed (${res.status})`);
  const data = await res.json();
  const a = data.address ?? {};
  const street = [a.road, a.house_number].filter(Boolean).join(" ");
  const city = a.city ?? a.town ?? a.village ?? a.county ?? "";
  return (
    [street, city].filter(Boolean).join(", ") || (data.display_name as string)
  );
}

function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) =>
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      timeout: 10000,
    }),
  );
}

async function geocode(
  query: string,
): Promise<{ lat: number; lng: number; displayName: string }> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Geocoding failed (${res.status})`);
  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0)
    throw new Error("Location not found");
  return {
    lat: parseFloat(data[0].lat),
    lng: parseFloat(data[0].lon),
    displayName: data[0].display_name,
  };
}

export default function OptionsPage(): React.ReactElement {
  const [options, setOptions] = useState<Options>(DEFAULT_OPTIONS);
  const [locationText, setLocationText] = useState("");
  const [geocoding, setGeocoding] = useState(false);
  const [locating, setLocating] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    browser.storage.local.get(OPTIONS_STORAGE_KEY).then((result) => {
      const stored = result[OPTIONS_STORAGE_KEY] as Options | undefined;
      if (stored) {
        setOptions(stored);
        if (stored.homeLocation?.label) {
          setLocationText(stored.homeLocation.label);
        } else if (stored.homeLocation) {
          setLocationText(
            `${stored.homeLocation.lat}, ${stored.homeLocation.lng}`,
          );
        }
      }
    });
  }, []);

  const priorityOrder = weightsToOrder(options.weights);

  const moveUp = (key: PriorityKey) => {
    const order = [...priorityOrder];
    const idx = order.indexOf(key);
    if (idx <= 0) return;
    [order[idx - 1], order[idx]] = [order[idx], order[idx - 1]];
    const orderKey = order.join(",");
    const weights = WEIGHT_VALUES[ORDER_TO_INDEX[orderKey] ?? 0];
    setOptions((o) => ({ ...o, weights }));
  };

  const moveDown = (key: PriorityKey) => {
    const order = [...priorityOrder];
    const idx = order.indexOf(key);
    if (idx >= order.length - 1) return;
    [order[idx], order[idx + 1]] = [order[idx + 1], order[idx]];
    const orderKey = order.join(",");
    const weights = WEIGHT_VALUES[ORDER_TO_INDEX[orderKey] ?? 0];
    setOptions((o) => ({ ...o, weights }));
  };

  const handleUseMyLocation = async () => {
    setLocating(true);
    setError("");
    try {
      const pos = await getCurrentPosition();
      const { latitude: lat, longitude: lng } = pos.coords;
      const city = await reverseGeocode(lat, lng);
      setLocationText(city);
      setOptions((o) => ({ ...o, homeLocation: { lat, lng, label: city } }));
    } catch (err) {
      if (err instanceof GeolocationPositionError) {
        setError(
          err.code === 1
            ? "Location access denied"
            : "Could not determine your location",
        );
      } else {
        setError(err instanceof Error ? err.message : "Location lookup failed");
      }
    } finally {
      setLocating(false);
    }
  };

  const handleLookup = async () => {
    const query = locationText.trim();
    if (!query) return;
    setGeocoding(true);
    setError("");
    try {
      const result = await geocode(query);
      const label = `${result.lat.toFixed(5)}, ${result.lng.toFixed(5)}`;
      setLocationText(label);
      setOptions((o) => ({
        ...o,
        homeLocation: {
          lat: result.lat,
          lng: result.lng,
          label: result.displayName,
        },
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Geocoding failed");
    } finally {
      setGeocoding(false);
    }
  };

  const handleSave = async () => {
    setError("");

    // If the text changed after a lookup, check if it's raw coords
    let homeLocation = options.homeLocation;
    if (locationText.trim()) {
      const match = locationText
        .trim()
        .match(/^(-?\d+\.?\d*),\s*(-?\d+\.?\d*)$/);
      if (
        match &&
        (!homeLocation || homeLocation.label !== locationText.trim())
      ) {
        homeLocation = {
          lat: parseFloat(match[1]),
          lng: parseFloat(match[2]),
          label: locationText.trim(),
        };
      } else if (!homeLocation) {
        setError(
          'Enter a city name and click "Look up", or enter "lat, lng" directly',
        );
        return;
      }
    } else {
      homeLocation = undefined;
    }

    const updated: Options = { ...options, homeLocation };
    await browser.storage.local.set({ [OPTIONS_STORAGE_KEY]: updated });
    setOptions(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="max-w-xl mx-auto p-6 font-sans">
      <div className="gap-3 mb-6">
        <h1 className="text-xl font-bold text-gray-900">TP Komoot Plugin</h1>
        <p className="text-sm text-gray-500">Route matching settings</p>
      </div>

      {/* Matching Priority */}
      <section className="mb-6">
        <h2 className="text-sm font-semibold text-gray-800 mb-1">
          Matching Priority
        </h2>
        <p className="text-xs text-gray-500 mb-3">
          Use arrows to reorder. The top metric has the most influence on route
          suggestions.
        </p>
        <div className="space-y-2">
          {priorityOrder.map((key, i) => (
            <div
              key={key}
              className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg px-3 py-2"
            >
              <span className="text-xs text-gray-400 w-4">{i + 1}</span>
              <span className="flex-1 text-sm font-medium text-gray-700">
                {PRIORITY_LABELS[key]}
              </span>
              <span className="text-xs text-gray-400">
                {Math.round(options.weights[key] * 100)}%
              </span>
              <div className="flex flex-col gap-0.5">
                <button
                  onClick={() => moveUp(key)}
                  disabled={i === 0}
                  className="text-gray-400 hover:text-gray-600 disabled:opacity-20 leading-none px-1"
                >
                  ▲
                </button>
                <button
                  onClick={() => moveDown(key)}
                  disabled={i === priorityOrder.length - 1}
                  className="text-gray-400 hover:text-gray-600 disabled:opacity-20 leading-none px-1"
                >
                  ▼
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Home Location */}
      <section className="mb-6">
        <h2 className="text-sm font-semibold text-gray-800 mb-1">
          Home Location
        </h2>
        <p className="text-xs text-gray-500 mb-2">
          Used as the center for route searches. Use your current location, or
          type a city and country and click <strong>Look up</strong>.
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={locationText}
            onChange={(e) => {
              setLocationText(e.target.value);
              setOptions((o) => ({ ...o, homeLocation: undefined }));
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleLookup();
            }}
            placeholder="e.g. Munich, Germany"
            disabled={geocoding || locating}
            className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500 disabled:opacity-50"
          />
          <button
            onClick={handleUseMyLocation}
            disabled={geocoding || locating}
            className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
          >
            {locating ? "…" : "📍 Use current location"}
          </button>
          <button
            onClick={handleLookup}
            disabled={geocoding || locating || !locationText.trim()}
            className="px-3 py-2 text-sm font-medium text-primary-text bg-primary rounded hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
          >
            {geocoding ? "…" : "Look up"}
          </button>
        </div>
        {options.homeLocation && (
          <p className="text-xs text-primary-hover mt-1.5">
            ✓ {options.homeLocation.lat.toFixed(4)},{" "}
            {options.homeLocation.lng.toFixed(4)}
            {options.homeLocation.label &&
              options.homeLocation.label !== locationText && (
                <span className="text-gray-400 ml-1 truncate block max-w-full">
                  {options.homeLocation.label}
                </span>
              )}
          </p>
        )}
        {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      </section>

      {/* Max Results */}
      <section className="mb-6">
        <h2 className="text-sm font-semibold text-gray-800 mb-1">
          Max Results
        </h2>
        <p className="text-xs text-gray-500 mb-2">
          Number of route suggestions to show.
        </p>
        <div className="flex gap-2">
          {([3, 5, 10] as const).map((n) => (
            <button
              key={n}
              onClick={() => setOptions((o) => ({ ...o, maxResults: n }))}
              className={`px-4 py-1.5 text-sm rounded border transition-colors ${
                options.maxResults === n
                  ? "bg-primary text-primary-text border-primary"
                  : "text-gray-700 border-gray-300 hover:border-gray-400"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </section>

      {/* Save */}
      <button
        onClick={handleSave}
        className="w-full bg-primary text-primary-text font-medium py-2 rounded hover:bg-primary-hover transition-colors"
      >
        {saved ? "✓ Saved!" : "Save Settings"}
      </button>
    </div>
  );
}
