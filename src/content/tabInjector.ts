/**
 * Injects the Komoot tab into the TrainingPeaks workout quick-view panel.
 *
 * Verified structure (from DevTools inspection):
 *
 *   .workoutQuickView
 *     div
 *       .QVHeader
 *       div
 *         .tabNavigation          ← add our tab button here
 *           .summaryTab.tabSelected
 *           .mapGraphTab.missingData
 *           ...
 *         .tabContent.tabContentRegion   ← hide when Komoot tab active
 *         .workoutStructureDetailsRegion
 *       .quickviewFooter
 *
 * The caller (content/index.ts) passes the already-found tabNav element,
 * so injection is synchronous — no waiting or polling needed.
 */

import React from "react";
import ReactDOM from "react-dom/client";
// Inlined at build time by Vite — avoids runtime fetch and extension-context issues
import TAILWIND_CSS from "../styles/tailwind.css?inline";
import TAB_ICON_SVG from "./tabIcon.svg?raw";
import { parseWorkout } from "./workoutParser";
import { KomootTab } from "../ui/KomootTab";

const TAB_CONTENT_SELECTOR = ".tabContent.tabContentRegion";

export async function injectKomootTab(
  panel: Element,
  tabNav: Element,
): Promise<void> {
  const workout = parseWorkout(panel);

  // ── Tab button ─────────────────────────────────────────────────────────────
  const komootTab = document.createElement("div");
  komootTab.className = "komootTab";
  komootTab.title = "Komoot";
  komootTab.setAttribute("data-komoot-tab-btn", "true");
  komootTab.style.cssText = [
    "background:transparent",
    "cursor:pointer",
    "display:flex",
    "align-items:center",
    "justify-content:center",
    "height:30px",
    "border-radius:4px",
    "transition:opacity 0.15s",
    "user-select:none",
    "margin:12px 0 0 4px",
  ].join(";");

  const iconDiv = document.createElement("div");
  iconDiv.innerHTML = TAB_ICON_SVG;
  komootTab.appendChild(iconDiv);
  tabNav.appendChild(komootTab);

  // ── Shadow DOM content panel ───────────────────────────────────────────────
  const komootContent = document.createElement("div");
  komootContent.setAttribute("data-komoot-content", "true");
  komootContent.style.display = "none";

  const shadow = komootContent.attachShadow({ mode: "open" });

  // CSS is inlined at build time — no runtime fetch needed
  const style = document.createElement("style");
  style.textContent = TAILWIND_CSS;
  shadow.appendChild(style);

  const mountPoint = document.createElement("div");
  shadow.appendChild(mountPoint);

  // Insert our content panel right after .tabContent
  const tabContent = panel.querySelector(TAB_CONTENT_SELECTOR);
  if (tabContent) {
    tabContent.parentElement?.insertBefore(
      komootContent,
      tabContent.nextSibling,
    );
  } else {
    panel.querySelector(".workoutQuickView > div")?.appendChild(komootContent);
  }

  // ── Tab switching ──────────────────────────────────────────────────────────
  const activateKomoot = () => {
    tabNav
      .querySelectorAll('[class*="Tab"]:not([data-komoot-tab-btn])')
      .forEach((t) => {
        t.classList.remove("tabSelected");
      });
    komootTab.classList.add("tabSelected");
    komootTab.style.background = "rgba(37, 47, 63, .08)";
    if (tabContent) (tabContent as HTMLElement).style.display = "none";
    komootContent.style.display = "";
  };

  const deactivateKomoot = () => {
    komootTab.classList.remove("tabSelected");
    komootContent.style.background = "transparent";
    komootContent.style.display = "none";
    if (tabContent) (tabContent as HTMLElement).style.display = "";
  };

  komootTab.addEventListener("click", activateKomoot);

  tabNav.addEventListener("click", (e) => {
    const target = (e.target as Element).closest('[class*="Tab"]');
    if (!target || target === komootTab) return;
    deactivateKomoot();
  });

  // ── Mount React ────────────────────────────────────────────────────────────
  ReactDOM.createRoot(mountPoint).render(
    React.createElement(KomootTab, { workout }),
  );
}
