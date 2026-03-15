# Privacy Policy — TrainingPeaks Komoot Extension

_Last updated: March 2026_

## Summary

This extension does not collect, transmit, or store any personal data on external servers. All data stays on your device.

## What the extension accesses

To function, the extension reads the following data locally in your browser:

- **TrainingPeaks workout data** — sport type, date, planned duration, distance, and elevation are read from the TrainingPeaks page you are viewing and used to search for matching Komoot routes. This data is not stored.
- **Your Komoot account** — the extension uses your existing Komoot browser session (cookies) to make requests to the Komoot API on your behalf. Your Komoot user ID and display name are stored locally on your device (in `browser.storage.local`) so the extension can identify your account between uses.
- **Home location** — if you set a home location in the extension options, that latitude and longitude is stored locally on your device and used to search for nearby routes.
- **TrainingPeaks athlete ID** — read from the page at the time you attach a route to a workout and used solely to make that update via the TrainingPeaks API. It is not stored.

## What the extension does not do

- Does not send any data to the extension developer or any third-party server
- Does not use analytics or tracking
- Does not store passwords or authentication credentials
- Does not access any data beyond what is needed to show route suggestions and matched activities

## Third-party services

The extension communicates directly between your browser and two services you already use:

- **Komoot** (`www.komoot.com`) — to search for routes and retrieve your activities
- **TrainingPeaks** (`tpapi.trainingpeaks.com`) — to update workout descriptions when you attach a route

These requests are made using your existing sessions in those services. The extension developer has no visibility into these requests.

## Data removal

All locally stored data (Komoot user ID, display name, home location) can be removed at any time by uninstalling the extension or clearing extension storage via your browser's developer tools.

## Contact

For questions, open an issue at [github.com/nagelflorian/trainingpeaks-komoot-extension](https://github.com/nagelflorian/trainingpeaks-komoot-extension/issues).
