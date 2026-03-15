import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { parseWorkout } from "./workoutParser";

// ─── DOM builder helpers ───────────────────────────────────────────────────────

/**
 * Build a minimal TrainingPeaks workout panel DOM and append it to document.body.
 * Returns the panel element for passing to parseWorkout().
 */
function buildPanel({
  sportClass = "Run",
  completed = false,
  duration = "",
  distance = "",
  elevation = "",
  dateText = "Friday 28 February, 2026",
  workoutTitle = "Morning Run",
  workoutId = "12345",
}: {
  sportClass?: string;
  completed?: boolean;
  duration?: string;
  distance?: string;
  elevation?: string;
  dateText?: string;
  workoutTitle?: string;
  workoutId?: string;
} = {}): Element {
  const panel = document.createElement("div");
  panel.className = "workoutQuickView";

  // Sport type
  const workoutBarView = document.createElement("div");
  workoutBarView.className = "workoutBarView";
  const workoutEl = document.createElement("div");
  workoutEl.className = `workout ${sportClass}`;
  workoutBarView.appendChild(workoutEl);
  panel.appendChild(workoutBarView);

  // Compliance / stats
  const compliance = document.createElement("div");
  compliance.className = "workoutComplianceStatus";
  const keyStats = document.createElement("div");
  keyStats.className = `keyStats${completed ? " completed" : ""}`;

  const durationEl = document.createElement("span");
  durationEl.className = "duration";
  durationEl.textContent = duration;
  keyStats.appendChild(durationEl);

  const distanceEl = document.createElement("span");
  distanceEl.className = "distance";
  distanceEl.textContent = distance;
  keyStats.appendChild(distanceEl);

  const elevationEl = document.createElement("span");
  elevationEl.className = "elevation";
  elevationEl.textContent = elevation;
  keyStats.appendChild(elevationEl);

  compliance.appendChild(keyStats);
  panel.appendChild(compliance);

  // Date
  const dateAndTime = document.createElement("div");
  dateAndTime.className = "dateAndTime";
  const dateSpan = document.createElement("span");
  dateSpan.textContent = dateText;
  dateAndTime.appendChild(dateSpan);
  panel.appendChild(dateAndTime);

  // Title
  const titleInput = document.createElement("input");
  titleInput.className = "workoutTitle";
  titleInput.value = workoutTitle;
  panel.appendChild(titleInput);

  // Workout ID (on a selected calendar item in the document)
  const calendarItem = document.createElement("div");
  calendarItem.className = "activity workout selected";
  calendarItem.setAttribute("data-workoutid", workoutId);
  document.body.appendChild(calendarItem);

  document.body.appendChild(panel);
  return panel;
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe("parseWorkout", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  describe("sport type", () => {
    it("parses Run → Running", () => {
      const panel = buildPanel({ sportClass: "Run" });
      expect(parseWorkout(panel).sportType).toBe("Running");
    });

    it("parses Bike → Cycling", () => {
      const panel = buildPanel({ sportClass: "Bike" });
      expect(parseWorkout(panel).sportType).toBe("Cycling");
    });

    it("parses MTB → MountainBike", () => {
      const panel = buildPanel({ sportClass: "MTB" });
      expect(parseWorkout(panel).sportType).toBe("MountainBike");
    });

    it("falls back to Other for unknown sport class", () => {
      const panel = buildPanel({ sportClass: "Unknown" });
      expect(parseWorkout(panel).sportType).toBe("Other");
    });

    it("handles lowercase sport classes", () => {
      const panel = buildPanel({ sportClass: "run" });
      expect(parseWorkout(panel).sportType).toBe("Running");
    });
  });

  describe("completion status", () => {
    it("is false when keyStats does not have .completed class", () => {
      const panel = buildPanel({ completed: false });
      expect(parseWorkout(panel).isCompleted).toBe(false);
    });

    it("is true when keyStats has .completed class", () => {
      const panel = buildPanel({ completed: true });
      expect(parseWorkout(panel).isCompleted).toBe(true);
    });
  });

  describe("date parsing", () => {
    it("parses a full date with day name", () => {
      const panel = buildPanel({ dateText: "Friday 28 February, 2026" });
      expect(parseWorkout(panel).date).toBe("2026-02-28");
    });

    it("parses a date without day name", () => {
      const panel = buildPanel({ dateText: "28 February, 2026" });
      expect(parseWorkout(panel).date).toBe("2026-02-28");
    });

    it("zero-pads single-digit days and months", () => {
      const panel = buildPanel({ dateText: "3 March, 2026" });
      expect(parseWorkout(panel).date).toBe("2026-03-03");
    });

    it("parses December correctly", () => {
      const panel = buildPanel({ dateText: "25 December, 2025" });
      expect(parseWorkout(panel).date).toBe("2025-12-25");
    });
  });

  describe("distance parsing", () => {
    it("parses kilometres", () => {
      const panel = buildPanel({ distance: "9.00 km" });
      expect(parseWorkout(panel).plannedDistanceM).toBeCloseTo(9000);
    });

    it("parses miles and converts to metres", () => {
      const panel = buildPanel({ distance: "5.6 mi" });
      expect(parseWorkout(panel).plannedDistanceM).toBeCloseTo(9012.3, 0);
    });

    it("returns undefined when distance is empty", () => {
      const panel = buildPanel({ distance: "" });
      expect(parseWorkout(panel).plannedDistanceM).toBeUndefined();
    });
  });

  describe("duration parsing", () => {
    it("parses H:MM:SS format", () => {
      const panel = buildPanel({ duration: "0:38:11" });
      expect(parseWorkout(panel).plannedDurationSec).toBe(38 * 60 + 11);
    });

    it("parses multi-hour durations", () => {
      const panel = buildPanel({ duration: "2:05:30" });
      expect(parseWorkout(panel).plannedDurationSec).toBe(
        2 * 3600 + 5 * 60 + 30,
      );
    });

    it("returns undefined when duration is empty", () => {
      const panel = buildPanel({ duration: "" });
      expect(parseWorkout(panel).plannedDurationSec).toBeUndefined();
    });
  });

  describe("elevation parsing", () => {
    it("parses metres", () => {
      const panel = buildPanel({ elevation: "450 m" });
      expect(parseWorkout(panel).plannedElevationM).toBeCloseTo(450);
    });

    it("parses feet and converts to metres", () => {
      const panel = buildPanel({ elevation: "1,476 ft" });
      expect(parseWorkout(panel).plannedElevationM).toBeCloseTo(449.9, 0);
    });

    it("returns undefined when elevation is empty", () => {
      const panel = buildPanel({ elevation: "" });
      expect(parseWorkout(panel).plannedElevationM).toBeUndefined();
    });
  });

  describe("workout ID", () => {
    it("reads workout ID from the selected calendar item", () => {
      const panel = buildPanel({ workoutId: "987654" });
      expect(parseWorkout(panel).workoutId).toBe("987654");
    });

    it("reads workout ID from panel data-workoutid attribute", () => {
      const panel = buildPanel();
      panel.setAttribute("data-workoutid", "111222");
      expect(parseWorkout(panel).workoutId).toBe("111222");
    });
  });

  describe("title", () => {
    it("reads the workout title input value", () => {
      const panel = buildPanel({ workoutTitle: "Long Run" });
      expect(parseWorkout(panel).title).toBe("Long Run");
    });
  });
});
