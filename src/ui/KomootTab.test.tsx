import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { KomootTab } from "./KomootTab";
import type { WorkoutMetadata } from "../types/trainingpeaks";
import type { KomootTour } from "../types/komoot";

// vi.mock is hoisted — must appear before the import it mocks
vi.mock("webextension-polyfill", () => ({
  default: {
    runtime: {
      sendMessage: vi.fn(),
    },
    action: { openPopup: vi.fn() },
  },
}));

import browser from "webextension-polyfill";
const mockSendMessage = vi.mocked(browser.runtime.sendMessage);

// ─── Fixtures ──────────────────────────────────────────────────────────────────

const defaultWorkout: WorkoutMetadata = {
  sportType: "Running",
  date: "2026-02-28",
  isCompleted: false,
  athleteId: "athlete-1",
  workoutId: "workout-1",
};

function makeTour(overrides: Partial<KomootTour> = {}): KomootTour {
  return {
    id: "1",
    name: "Test Tour",
    sport: "jogging",
    status: "public",
    date: "2026-02-28T08:00:00Z",
    distance: 10000,
    duration: 3600,
    elevation_up: 100,
    elevation_down: 100,
    ...overrides,
  };
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe("KomootTab", () => {
  beforeEach(() => {
    mockSendMessage.mockReset();
    document.body.innerHTML = "";
  });

  it("shows loading state while waiting for auth check", () => {
    // sendMessage never resolves → stays in loading
    mockSendMessage.mockImplementation(() => new Promise(() => {}));
    render(<KomootTab workout={defaultWorkout} />);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("shows sign-in prompt when not authenticated", async () => {
    mockSendMessage.mockResolvedValue({
      type: "AUTH_STATUS",
      payload: { loggedIn: false },
    });
    render(<KomootTab workout={defaultWorkout} />);
    await waitFor(() =>
      expect(screen.getByText("Sign in to Komoot")).toBeInTheDocument(),
    );
  });

  it("shows route suggestions for a planned workout", async () => {
    mockSendMessage
      .mockResolvedValueOnce({
        type: "AUTH_STATUS",
        payload: { loggedIn: true, userId: "user-1" },
      })
      .mockResolvedValueOnce({
        type: "SUGGESTIONS",
        payload: [makeTour({ name: "Morning Run Route" })],
      });
    render(<KomootTab workout={defaultWorkout} />);
    await waitFor(() =>
      expect(screen.getByText("Morning Run Route")).toBeInTheDocument(),
    );
    expect(screen.getByText(/Suggested Routes/)).toBeInTheDocument();
  });

  it("shows matched activities for a completed workout", async () => {
    const completedWorkout: WorkoutMetadata = {
      ...defaultWorkout,
      isCompleted: true,
    };
    mockSendMessage
      .mockResolvedValueOnce({
        type: "AUTH_STATUS",
        payload: { loggedIn: true, userId: "user-1" },
      })
      .mockResolvedValueOnce({
        type: "MATCHED_ACTIVITIES",
        payload: [makeTour({ name: "Completed Activity" })],
      });
    render(<KomootTab workout={completedWorkout} />);
    await waitFor(() =>
      expect(screen.getByText("Completed Activity")).toBeInTheDocument(),
    );
    expect(screen.getByText(/Matched Activities/)).toBeInTheDocument();
  });

  it("shows no-sport message for unsupported sport types", async () => {
    const swimWorkout: WorkoutMetadata = {
      ...defaultWorkout,
      sportType: "Swimming",
    };
    mockSendMessage.mockResolvedValue({
      type: "AUTH_STATUS",
      payload: { loggedIn: true, userId: "user-1" },
    });
    render(<KomootTab workout={swimWorkout} />);
    await waitFor(() =>
      expect(
        screen.getByText(/No route suggestions available for/),
      ).toBeInTheDocument(),
    );
  });

  it("shows empty state when no suggestions are returned", async () => {
    mockSendMessage
      .mockResolvedValueOnce({
        type: "AUTH_STATUS",
        payload: { loggedIn: true, userId: "user-1" },
      })
      .mockResolvedValueOnce({ type: "SUGGESTIONS", payload: [] });
    render(<KomootTab workout={defaultWorkout} />);
    await waitFor(() =>
      expect(screen.getByText(/No matching routes found/)).toBeInTheDocument(),
    );
  });

  it("shows empty state when no activities match the date", async () => {
    const completedWorkout: WorkoutMetadata = {
      ...defaultWorkout,
      isCompleted: true,
    };
    mockSendMessage
      .mockResolvedValueOnce({
        type: "AUTH_STATUS",
        payload: { loggedIn: true, userId: "user-1" },
      })
      .mockResolvedValueOnce({ type: "MATCHED_ACTIVITIES", payload: [] });
    render(<KomootTab workout={completedWorkout} />);
    await waitFor(() =>
      expect(
        screen.getByText(/No Komoot activities found/),
      ).toBeInTheDocument(),
    );
  });

  it("shows error message on API failure", async () => {
    mockSendMessage
      .mockResolvedValueOnce({
        type: "AUTH_STATUS",
        payload: { loggedIn: true, userId: "user-1" },
      })
      .mockResolvedValueOnce({
        type: "ERROR",
        payload: { message: "Set your home location in Options" },
      });
    render(<KomootTab workout={defaultWorkout} />);
    await waitFor(() =>
      expect(
        screen.getByText(/Set your home location in Options/),
      ).toBeInTheDocument(),
    );
  });

  it("sends FETCH_SUGGESTIONS with the full workout payload", async () => {
    mockSendMessage
      .mockResolvedValueOnce({
        type: "AUTH_STATUS",
        payload: { loggedIn: true, userId: "user-1" },
      })
      .mockResolvedValueOnce({ type: "SUGGESTIONS", payload: [] });

    const workoutWithMetrics: WorkoutMetadata = {
      ...defaultWorkout,
      plannedDistanceM: 10000,
      plannedDurationSec: 3600,
    };
    render(<KomootTab workout={workoutWithMetrics} />);

    await waitFor(() => expect(mockSendMessage).toHaveBeenCalledTimes(2));
    expect(mockSendMessage).toHaveBeenNthCalledWith(2, {
      type: "FETCH_SUGGESTIONS",
      payload: workoutWithMetrics,
    });
  });

  it("sends FETCH_MATCHED_ACTIVITIES with date and userId for completed workouts", async () => {
    mockSendMessage
      .mockResolvedValueOnce({
        type: "AUTH_STATUS",
        payload: { loggedIn: true, userId: "user-99" },
      })
      .mockResolvedValueOnce({ type: "MATCHED_ACTIVITIES", payload: [] });

    const completedWorkout: WorkoutMetadata = {
      ...defaultWorkout,
      isCompleted: true,
      date: "2026-02-28",
    };
    render(<KomootTab workout={completedWorkout} />);

    await waitFor(() => expect(mockSendMessage).toHaveBeenCalledTimes(2));
    expect(mockSendMessage).toHaveBeenNthCalledWith(2, {
      type: "FETCH_MATCHED_ACTIVITIES",
      payload: { date: "2026-02-28", userId: "user-99" },
    });
  });
});
