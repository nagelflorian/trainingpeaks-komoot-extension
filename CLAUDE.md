# CLAUDE.md — TP Komoot Plugin

Instructions and learnings for Claude Code working on this project. See `README.md` for project overview, build commands, installation, and configuration.

## Tech stack

| Layer          | Library                                    |
| -------------- | ------------------------------------------ |
| Language       | TypeScript (strict)                        |
| UI             | React 18 + Tailwind CSS v4                 |
| Build          | Vite + vite-plugin-web-extension           |
| Browser compat | webextension-polyfill (Safari + Chrome)    |
| CSS in content | Inlined at build time via `?inline` import |

**Tailwind CSS v4** — uses `@import "tailwindcss"` in `src/styles/tailwind.css`. No `tailwind.config.ts` needed.

## Project structure

```
src/
  background/
    index.ts          message router (GET_AUTH_STATUS, FETCH_SUGGESTIONS, FETCH_MATCHED_ACTIVITIES)
    auth.ts           session-cookie auth via account.komoot.com/v1/signin
    komootApi.ts      Komoot API client + route scoring/ranking
  content/
    index.ts          MutationObserver watching for .tabNavigation in TP DOM
    tabInjector.ts    injects Shadow DOM panel + tab button into TP quick-view
    workoutParser.ts  parses workout metadata from TP DOM
  ui/
    KomootTab.tsx     root React component (auth gate, loading, suggestions/activities)
    RouteCard.tsx     suggested route card (planned workouts)
    ActivityCard.tsx  matched activity card (completed workouts)
    ElevationChart.tsx
    formatters.ts     shared: formatDistance, formatDuration, formatSpeed, formatDate, formatSport
  types/
    komoot.ts         Komoot API types
    trainingpeaks.ts  TP workout types + SPORT_TYPE_MAP
    messages.ts       extension message types
  styles/
    tailwind.css      @import "tailwindcss"
  popup/             main.tsx, Popup.tsx, index.html
  options/           main.tsx, Options.tsx, index.html
public/
  manifest.json      MV3 manifest
  icons/             icon16/48/128.png
```

### macOS filename gotcha

Entry files are named `main.tsx` (not `popup.tsx` / `options.tsx`) because macOS has a case-insensitive filesystem — `popup.tsx` would collide with `Popup.tsx`.

## TrainingPeaks DOM structure (verified)

```
.workoutQuickView
  div
    .QVHeader
    div
      .tabNavigation          ← we inject our tab button here
        .summaryTab.tabSelected
        .mapGraphTab.missingData
        ...
      .tabContent.tabContentRegion   ← hidden when Komoot tab is active
      .workoutStructureDetailsRegion
    .quickviewFooter
```

**Injection strategy:** `MutationObserver` watches `document.body` for `.tabNavigation` nodes. When found, walks up to `.workoutQuickView` and calls `injectKomootTab()`. A `data-komoot-injected` attribute prevents double injection.

### Key TP DOM selectors

| Purpose                     | Selector / ID                                                         |
| --------------------------- | --------------------------------------------------------------------- |
| Workout panel               | `.workoutQuickView`                                                   |
| Tab bar                     | `.tabNavigation`                                                      |
| Tab content area            | `.tabContent.tabContentRegion`                                        |
| Sport type class            | `.workoutBarView .workout` → second className e.g. `"workout Run"`    |
| Completion status           | `.workoutComplianceStatus .keyStats` (has `.completed` class if done) |
| Duration field              | `.workoutComplianceStatus .keyStats .duration`                        |
| Distance field              | `.workoutComplianceStatus .keyStats .distance`                        |
| Elevation field             | `.workoutComplianceStatus .keyStats .elevation`                       |
| Date                        | `.dateAndTime span` → text e.g. `"Friday 27 February, 2026"`          |
| Workout title               | `.workoutTitle` (HTMLInputElement with `.value`)                      |
| Description field           | `#descriptionInput` (contenteditable div)                             |
| Selected workout (calendar) | `.activity.workout.selected[data-workoutid]`                          |

### Workout ID

The correct workout ID for the currently open panel is on the **selected calendar item**:

```typescript
document
  .querySelector(".activity.workout.selected[data-workoutid]")
  ?.getAttribute("data-workoutid");
```

**Do not** use `document.querySelector("[data-workoutid]")` — multiple workout elements exist in the TP DOM and the first match is almost certainly the wrong one. `#descriptionInput` has no `[data-workoutid]` ancestor (`.closest()` returns null), so that approach also doesn't work. Always resolve the workout ID dynamically at action time (not at injection time) using the selected calendar item.

### TP API field mapping

`#descriptionInput` content maps to the **`description`** field in the TP workout API — **not** `coachComments`. `coachComments` is a separate field not shown in that element.

### Writing to the description field

`#descriptionInput` is a contenteditable `<div>`. To update it and trigger TP's framework:

```typescript
el.innerText = newText;
el.dispatchEvent(new Event("input", { bubbles: true }));
el.dispatchEvent(new Event("change", { bubbles: true }));
```

If changes don't persist, try `new InputEvent("input", { bubbles: true })` instead.

## Shadow DOM / CSS

- Content script creates a Shadow DOM (`mode: "open"`) inside a `<div>` injected after `.tabContent`
- **Tailwind CSS is inlined at build time** via `import TAILWIND_CSS from "../styles/tailwind.css?inline"` — no runtime fetch, no extension-context URL issues
- **Tailwind CSS custom properties (`var(--shadow-*)` etc.) do not resolve reliably inside Shadow DOM.** Use inline `style` props for anything that doesn't render:
  ```tsx
  // ❌ may not work in Shadow DOM
  className="shadow-xl"
  // ✅ always works
  style={{ boxShadow: "0 10px 30px rgba(0,0,0,0.2)" }}
  ```
- React components inside Shadow DOM can still access `window.document` and interact with the main page DOM (e.g. `document.getElementById("descriptionInput")`)
- **`overflow-hidden` on a container clips absolutely-positioned children** (e.g. tooltips). To allow a tooltip to escape its card, remove `overflow-hidden` from ancestor containers and apply rounding directly to the `<img>` element with `rounded-t-lg` instead

## Komoot API

**Base URL:** `https://www.komoot.com/api/v007`

**Auth:** Session cookies via `credentials: "include"`. Sign in first at `account.komoot.com/v1/signin`.

### Actual API response shape for tours (verified)

`distance`, `duration`, `elevation_up`, `elevation_down`, `difficulty` are **top-level fields** — NOT nested under `summary`.

`summary` contains surface/way-type breakdown data only:

```json
{
  "id": "31220221",          // string, not number
  "name": "...",
  "sport": "jogging",
  "distance": 9094.0,        // meters — TOP LEVEL
  "duration": 3419,          // seconds — TOP LEVEL
  "elevation_up": 63.8,      // meters — TOP LEVEL
  "elevation_down": 63.8,    // meters — TOP LEVEL
  "difficulty": { "grade": "moderate", ... },  // TOP LEVEL
  "summary": {
    "surfaces": [...],       // surface type breakdown
    "way_types": [...]       // way type breakdown
  },
  "map_image": { "src": "...?width={width}&height={height}&crop={crop}", "templated": true },
  "vector_map_image": { "src": "..." },          // no template vars — use this for display
  "vector_map_image_preview": { "src": "..." },  // small version, no template vars
  "visitors": 147,
  "rating_count": 6,
  "rating_score": 4.17
}
```

### Image URLs

Prefer `vector_map_image.src` (full res, no template vars) for card thumbnails. `map_image.src` has `{width}`, `{height}`, `{crop}` placeholders that must be replaced:

```typescript
src
  .replace("{width}", "1200")
  .replace("{height}", "600")
  .replace("{crop}", "false");
```

### Route search endpoint (needs DevTools verification)

```
GET /api/v007/discover_tours/from_location/?sport[]=jogging&limit=20&lat=...&lng=...
```

Params `max_length` / `min_length` are in meters. See `src/background/komootApi.ts` for current implementation — marked `TODO: INSPECT_DEVTOOLS` for verification.

### Activity fetch endpoint

```
GET /api/v007/users/{userId}/activities/?page=0&limit=50
```

## Route scoring

Routes are never filtered out — the Komoot API pre-filters by sport and location. All returned routes are shown, ranked by match score.

`scoreTour()` in `komootApi.ts` computes a weighted score [0, 1] from:

- Duration match (weight 0.5)
- Distance match (weight 0.35)
- Elevation match (weight 0.15)

Each metric: `score = max(0, 1 - |planned - actual| / planned)`. If no planned metrics exist, returns neutral `0.5`. The breakdown is stored in `tour._scoreBreakdown` for the hover tooltip in `RouteCard`.

## Authentication

- **Method:** Unofficial session cookie auth — POST to `account.komoot.com/v1/signin` with `credentials: "include"`
- **Storage:** `browser.storage.local` key `komootAuth` → `{ userId, displayName }`
- **Auth check:** `GET_AUTH_STATUS` message → background replies with `AUTH_STATUS`
- If any API call returns 401, throw `new Error("AUTH_REQUIRED")` — the UI shows a sign-in prompt

## Message passing

All UI → background communication is via `browser.runtime.sendMessage`. Types defined in `src/types/messages.ts`.

| Message                                                | Response                                        |
| ------------------------------------------------------ | ----------------------------------------------- |
| `GET_AUTH_STATUS`                                      | `AUTH_STATUS { loggedIn, userId, displayName }` |
| `FETCH_SUGGESTIONS` (payload: WorkoutMetadata)         | `SUGGESTIONS KomootTour[]`                      |
| `FETCH_MATCHED_ACTIVITIES` (payload: { date, userId }) | `MATCHED_ACTIVITIES KomootTour[]`               |

## TP API — attaching a route to a workout

The "Attach to workout" feature does a GET → mutate → PUT cycle directly from the content script (not the background worker) so TP's session cookies are included automatically.

**Endpoint:** `PUT https://tpapi.trainingpeaks.com/fitness/v6/athletes/{athleteId}/workouts/{workoutId}`

**Flow:**

1. GET the full workout object
2. Modify `description` field (strip any existing `Route: https://www.komoot.com/...` line first, then append or remove)
3. Re-serialise `structure` field — it comes back as a parsed object from GET but must be a JSON **string** in PUT
4. PUT the full object back

**athleteId:** `localStorage.getItem("ajs_user_id")` (strip surrounding `"` quotes if present — it may be JSON-encoded)

**Only one route at a time:** Always strip any existing Komoot route line before adding a new one so duplicate/stale routes don't accumulate:

```typescript
const stripped = current
  .replace(/\n*Route: https:\/\/www\.komoot\.com\/[^\n]*/g, "")
  .trimEnd();
```

## Cross-card state synchronisation

When multiple `RouteCard` components need to react to each other's attach/detach actions, **lift the shared state to the parent** (`KomootTab`) rather than keeping independent per-card local state:

- `KomootTab` holds `description` (initialised from `#descriptionInput.innerText`)
- Each `RouteCard` derives `isAdded` from `description.includes(\`Route: \${komootUrl}\`)` — no local state needed
- After a successful API update the card calls `onDescriptionChange(savedDescription)`, updating the parent state and causing all cards to re-render with correct button labels

## SVG imports

Tab icon and other SVGs are imported with the `?raw` suffix to get the raw SVG string (supported by `vite/client` types, already in `tsconfig.app.json`):

```typescript
import TAB_ICON_SVG from "./tabIcon.svg?raw";
```

**Vanilla DOM (content script):**

```typescript
iconDiv.innerHTML = TAB_ICON_SVG;
```

**React:**

```tsx
<span dangerouslySetInnerHTML={{ __html: TAB_ICON_SVG }} />
```

**White icon on coloured background** (e.g. popup header): apply a CSS filter instead of editing the SVG:

```tsx
<span
  dangerouslySetInnerHTML={{ __html: TAB_ICON_SVG }}
  style={{ filter: "brightness(0) invert(1)" }}
/>
```

## Testing

- **Runner:** Vitest with jsdom environment (simulates browser DOM in Node)
- **Config:** `vitest.config.ts` is a **separate file** from `vite.config.ts` — this keeps `vite-plugin-web-extension` out of test runs; also add `@vitejs/plugin-react` to the Vitest config for JSX transformation
- **Test file location:** `src/**/*.test.{ts,tsx}` co-located with source files
- **Test suites:** `formatters.test.ts`, `komootApi.test.ts`, `workoutParser.test.ts`, `KomootTab.test.tsx`, `RouteCard.test.tsx` — 72 tests total
- **React components:** `@testing-library/react` + `@testing-library/user-event` + `@testing-library/jest-dom`; mock `webextension-polyfill` with `vi.mock()` at the top of each test file
- **Global setup:** `src/test-utils/setup.ts` — imported via `setupFiles` in `vitest.config.ts`, loads jest-dom matchers

```typescript
// vitest.config.ts
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["src/test-utils/setup.ts"],
  },
});
```

Run tests: `npm test` (runs `vitest run` — single pass, no watch).

### Playwright E2E tests

- **Location:** `tests/injection.spec.ts` — covers injection, tab switching, Shadow DOM rendering
- **Key trick:** intercept `https://app.trainingpeaks.com/*` with `page.route()` and serve local fixture HTML — the content script injects naturally because Chrome still sees the matching URL; **no manifest changes required**
- **Headless mode with extensions:** `headless: false` + `"--headless=new"` arg in `launchPersistentContext`. Setting `headless: true` uses old headless mode which doesn't support extensions; the new mode works in CI without a virtual display
- **Service worker discovery:** `context.serviceWorkers()[0]` or `context.waitForEvent("serviceworker")` — the URL is `chrome-extension://<id>/...` so split on `/` to get the ID
- **Shadow DOM:** Playwright pierces open Shadow DOMs automatically with text locators (`page.getByText()`, `page.getByRole()`) — no special handling needed
- **ESLint false positives for Playwright fixtures:** Playwright's `use()` callback is misidentified as a React hook, and `{}` destructuring as an empty pattern. Add a `tests/**` override block AFTER the main config block in `eslint.config.js` to disable those rules (order matters — later blocks win in flat config)

Run E2E: `npm run test:e2e` (requires `dist/` to exist — run `npm run build` first).

## Code quality tooling

### ESLint (`eslint.config.js`)

Key rule decisions:

- `no-console: ["error", { allow: ["warn", "error"] }]` — blocks stray `console.log` in production code
- `@typescript-eslint/no-unused-vars: ["error", { argsIgnorePattern: "^_" }]` — prefix intentionally-unused callback args with `_`
- `react-hooks/set-state-in-effect: "off"` — disabled because it produces false positives for the async fetch-then-setState pattern used in `Popup.tsx` and `KomootTab.tsx`

### Prettier (`.prettierrc`)

```json
{
  "semi": true,
  "singleQuote": false,
  "trailingComma": "all",
  "printWidth": 80,
  "tabWidth": 2
}
```

### Husky + lint-staged

Pre-commit hook runs `npx lint-staged`, which applies `eslint --fix` + `prettier --write` to staged `src/**/*.{ts,tsx}` files. Setup: `npx husky init` creates `.husky/pre-commit`; `"prepare": "husky"` in `package.json` auto-installs hooks after `npm install`.

### CI (`.github/workflows/ci.yml`)

Step order: `tsc -b` → `npm test` → `eslint` → `prettier --check` → `vite build` → upload `dist/` artifact (7-day retention). TypeScript check runs before tests to catch type errors early.

## Maintenance

- If TP updates their DOM structure, selectors in `workoutParser.ts` and `tabInjector.ts` may need updating
