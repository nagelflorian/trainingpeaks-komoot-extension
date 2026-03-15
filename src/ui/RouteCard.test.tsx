import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouteCard } from "./RouteCard";
import type { KomootTour } from "../types/komoot";

// ─── Fixtures ──────────────────────────────────────────────────────────────────

function makeTour(overrides: Partial<KomootTour> = {}): KomootTour {
  return {
    id: "tour-123",
    name: "Test Tour",
    sport: "jogging",
    status: "public",
    date: "2026-02-28T08:00:00Z",
    distance: 9094,
    duration: 3419,
    elevation_up: 63,
    elevation_down: 63,
    ...overrides,
  };
}

const KOMOOT_URL =
  "https://www.komoot.com/smarttour/tour-123?tour_origin=smart_tour_search";
const ATTACHED_DESCRIPTION = `Route: ${KOMOOT_URL}`;

const DEFAULT_PROPS = {
  athleteId: "athlete-1",
  workoutId: "workout-999",
} as const;

const mockWorkoutData = { description: "My workout notes", structure: null };

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe("RouteCard", () => {
  beforeEach(() => {
    // DOM elements the card reads at click time
    document.body.innerHTML = `
      <div class="activity workout selected" data-workoutid="workout-999"></div>
      <div id="descriptionInput"></div>
    `;
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  describe("attach state display", () => {
    it("shows Attach route when the route is not in the description", () => {
      render(
        <RouteCard
          tour={makeTour()}
          description=""
          onDescriptionChange={vi.fn()}
          {...DEFAULT_PROPS}
        />,
      );
      expect(
        screen.getByRole("button", { name: "Attach route" }),
      ).toBeInTheDocument();
    });

    it("shows Detach route when the route URL is in the description", () => {
      render(
        <RouteCard
          tour={makeTour()}
          description={ATTACHED_DESCRIPTION}
          onDescriptionChange={vi.fn()}
          {...DEFAULT_PROPS}
        />,
      );
      expect(
        screen.getByRole("button", { name: "Detach route" }),
      ).toBeInTheDocument();
    });

    it("disables the button when no athleteId is provided", () => {
      render(
        <RouteCard
          tour={makeTour()}
          description=""
          onDescriptionChange={vi.fn()}
        />,
      );
      const btn = screen.getByRole("button", { name: "Attach route" });
      expect(btn).toBeDisabled();
    });
  });

  describe("attaching a route", () => {
    it("calls the TP API and notifies the parent of the new description", async () => {
      const user = userEvent.setup();
      const onDescriptionChange = vi.fn();

      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ ...mockWorkoutData }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({}),
        } as Response);

      render(
        <RouteCard
          tour={makeTour()}
          description=""
          onDescriptionChange={onDescriptionChange}
          {...DEFAULT_PROPS}
        />,
      );

      await user.click(screen.getByRole("button", { name: "Attach route" }));

      await waitFor(() =>
        expect(onDescriptionChange).toHaveBeenCalledWith(
          expect.stringContaining(`Route: ${KOMOOT_URL}`),
        ),
      );
      // GET + PUT
      expect(fetch).toHaveBeenCalledTimes(2);
      const putCall = vi.mocked(fetch).mock.calls[1];
      expect((putCall[1] as RequestInit).method).toBe("PUT");
    });

    it("uses the selected workout ID from the DOM rather than the prop", async () => {
      const user = userEvent.setup();

      // DOM has a different workout ID than the prop
      document.body.innerHTML = `
        <div class="activity workout selected" data-workoutid="dom-workout-456"></div>
        <div id="descriptionInput"></div>
      `;

      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ ...mockWorkoutData }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({}),
        } as Response);

      render(
        <RouteCard
          tour={makeTour()}
          description=""
          onDescriptionChange={vi.fn()}
          athleteId="athlete-1"
          workoutId="prop-workout-999"
        />,
      );

      await user.click(screen.getByRole("button", { name: "Attach route" }));

      await waitFor(() =>
        expect(fetch).toHaveBeenNthCalledWith(
          1,
          expect.stringContaining("/workouts/dom-workout-456"),
          expect.any(Object),
        ),
      );
    });

    it("strips any existing Komoot route and replaces it with the new one", async () => {
      const user = userEvent.setup();
      const onDescriptionChange = vi.fn();

      const oldUrl =
        "https://www.komoot.com/smarttour/old-id?tour_origin=smart_tour_search";
      const existingDescription = `Workout notes\n\nRoute: ${oldUrl}`;

      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            description: existingDescription,
            structure: null,
          }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({}),
        } as Response);

      render(
        <RouteCard
          tour={makeTour()}
          description={existingDescription}
          onDescriptionChange={onDescriptionChange}
          {...DEFAULT_PROPS}
        />,
      );

      await user.click(screen.getByRole("button", { name: "Attach route" }));

      await waitFor(() => expect(onDescriptionChange).toHaveBeenCalled());
      const saved = onDescriptionChange.mock.calls[0][0] as string;
      expect(saved).toContain(KOMOOT_URL);
      expect(saved).not.toContain(oldUrl);
    });

    it("shows an inline error when the TP GET request fails", async () => {
      const user = userEvent.setup();

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({}),
      } as Response);

      render(
        <RouteCard
          tour={makeTour()}
          description=""
          onDescriptionChange={vi.fn()}
          {...DEFAULT_PROPS}
        />,
      );

      await user.click(screen.getByRole("button", { name: "Attach route" }));

      await waitFor(() =>
        expect(screen.getByText(/TP GET failed/)).toBeInTheDocument(),
      );
    });
  });

  describe("detaching a route", () => {
    it("removes the route line from the description on detach", async () => {
      const user = userEvent.setup();
      const onDescriptionChange = vi.fn();

      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            description: `Notes\n\n${ATTACHED_DESCRIPTION}`,
            structure: null,
          }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({}),
        } as Response);

      render(
        <RouteCard
          tour={makeTour()}
          description={ATTACHED_DESCRIPTION}
          onDescriptionChange={onDescriptionChange}
          {...DEFAULT_PROPS}
        />,
      );

      await user.click(screen.getByRole("button", { name: "Detach route" }));

      await waitFor(() => expect(onDescriptionChange).toHaveBeenCalled());
      const saved = onDescriptionChange.mock.calls[0][0] as string;
      expect(saved).not.toContain(KOMOOT_URL);
    });
  });

  describe("cross-card state sync", () => {
    it("switches to Detach when description prop is updated by a sibling card", () => {
      const { rerender } = render(
        <RouteCard
          tour={makeTour()}
          description=""
          onDescriptionChange={vi.fn()}
          {...DEFAULT_PROPS}
        />,
      );
      expect(
        screen.getByRole("button", { name: "Attach route" }),
      ).toBeInTheDocument();

      rerender(
        <RouteCard
          tour={makeTour()}
          description={ATTACHED_DESCRIPTION}
          onDescriptionChange={vi.fn()}
          {...DEFAULT_PROPS}
        />,
      );
      expect(
        screen.getByRole("button", { name: "Detach route" }),
      ).toBeInTheDocument();
    });
  });
});
