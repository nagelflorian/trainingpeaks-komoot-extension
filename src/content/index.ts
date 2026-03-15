/**
 * Content script entry point.
 *
 * Strategy: watch for .tabNavigation appearing in the DOM, then walk up
 * to find .workoutQuickView. This guarantees both the panel and tab bar
 * are fully rendered before injection.
 */

import { injectKomootTab } from "./tabInjector";

const INJECTED_ATTR = "data-komoot-injected";

function tryInjectForTabNav(tabNav: Element): void {
  const panel = tabNav.closest(".workoutQuickView");
  if (!panel) return;
  if (panel.getAttribute(INJECTED_ATTR)) return;

  panel.setAttribute(INJECTED_ATTR, "true");
  injectKomootTab(panel, tabNav).catch((err) => {
    console.error("[TP Komoot] Injection failed:", err);
    panel.removeAttribute(INJECTED_ATTR);
  });
}

// Check if already in DOM (e.g. page loaded before content script)
document.querySelectorAll(".tabNavigation").forEach(tryInjectForTabNav);

const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (!(node instanceof Element)) continue;
      if (node.matches(".tabNavigation")) {
        tryInjectForTabNav(node);
      }
      node.querySelectorAll(".tabNavigation").forEach(tryInjectForTabNav);
    }
  }
});

observer.observe(document.body, { childList: true, subtree: true });
