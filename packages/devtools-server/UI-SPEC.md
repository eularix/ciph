# UI Specification — @ciph/devtools-server

## Technology

The inspector UI is built with **vanilla HTML + CSS + JavaScript** — no framework, no bundler, no external CDN dependencies. The entire UI is served as a single inline HTML response from the `/ciph` endpoint.

Reasons for vanilla approach:
- No React/Vue dependency on the server package
- Works in any environment without build setup
- Smaller payload, instant load
- No supply chain risk from frontend deps in a backend package

---

## Page Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│  🔒 Ciph Inspector          🟢 Live   [Clear All]  [Export JSON]    │
├──────────────────────────────────────────────────────────────────────┤
│  Filter: [____________] Status: [All ▾] Method: [All ▾]             │
├────────┬─────────────────────────┬────────┬───────┬──────────────────┤
│ METHOD │ ROUTE                   │ STATUS │  TIME │ TIMESTAMP        │
├────────┼─────────────────────────┼────────┼───────┼──────────────────┤
│  POST  │ /employees              │  201   │  34ms │ 20:01:12.443     │
│  GET   │ /materials-list         │  200   │  12ms │ 20:01:10.201     │
│  PATCH │ /employees/abc-123      │  200   │   8ms │ 20:01:08.093     │
│  GET   │ /health                 │  200   │   2ms │ 20:01:06.772     │
└────────┴─────────────────────────┴────────┴───────┴──────────────────┘
               ↓ click a row
```

---

## Detail Panel (Row Click)

Clicking a row opens a detail panel below the table:

```
┌─────────────────────────────────────────────────────────────────────┐
│  POST /employees  ·  201  ·  34ms  ·  2026-04-16 20:01:12          │
│  IP: 127.0.0.1  ·  UA: Mozilla/5.0 Chrome/124                      │
├──────────────────────────┬──────────────────────────────────────────┤
│  REQUEST                 │  RESPONSE                                │
├──────────────────────────┼──────────────────────────────────────────┤
│  Plain Body              │  Plain Body                              │
│  {                       │  {                                       │
│    "name": "Dimas",      │    "data": {                             │
│    "role": "engineer",   │      "id": "abc-123",                    │
│    "salary": 15000000    │      "name": "Dimas"                     │
│  }                       │    }                                     │
│                          │  }                                       │
│  ──────────────          │                                          │
│  Encrypted Body          │  Encrypted Body                          │
│  aB3kX9mL...  [Copy]     │  cD7nY4qR...  [Copy]                    │
├──────────────────────────┴──────────────────────────────────────────┤
│  FINGERPRINT                                                        │
│  Hash:      a3f8b2c9d1...                                           │
│  IP Match:  ✅ 127.0.0.1                                            │
│  UA Match:  ✅ Mozilla/5.0...                                       │
├─────────────────────────────────────────────────────────────────────┤
│  HEADERS (Request)                                                  │
│  X-Fingerprint:  aB3k...  (encrypted)                               │
│  Content-Type:   text/plain                                         │
│  Authorization:  Bearer eyJ...                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Live Indicator

```
🟢 Live    — SSE connection active, receiving logs
🔴 Offline — SSE connection lost (auto-reconnect after 3s)
🟡 Paused  — user clicked pause button; logs still buffered but not displayed
```

Auto-reconnect: if SSE disconnects, the UI retries every 3 seconds with exponential backoff (max 30s).

---

## Filter Bar

| Filter   | Options                                 |
|----------|-----------------------------------------|
| Search   | Free text — matches against route path  |
| Status   | All / 2xx / 3xx / 4xx / 5xx            |
| Method   | All / GET / POST / PUT / PATCH / DELETE |

Filters are applied client-side on the in-memory log list (no new SSE subscription needed).

---

## Color Coding

| Element      | Color                          |
|--------------|--------------------------------|
| GET badge    | Blue                           |
| POST badge   | Green                          |
| PUT badge    | Orange                         |
| PATCH badge  | Purple                         |
| DELETE badge | Red                            |
| 2xx status   | Green text                     |
| 4xx status   | Orange text                    |
| 5xx status   | Red text                       |
| Ciph error row | Red tint background          |
| Excluded row   | Muted / gray tint            |

---

## Export JSON

The **Export JSON** button downloads all currently visible (filtered) logs as a `.json` file:

```json
{
  "exported_at": "2026-04-16T20:15:00.000Z",
  "total": 42,
  "logs": [ ... ]
}
```

This is useful for sharing a debugging session with a teammate.

---

## Keyboard Shortcuts (Inspector UI)

| Shortcut      | Action                         |
|---------------|--------------------------------|
| `Escape`      | Close detail panel             |
| `Ctrl+K`      | Focus filter/search input      |
| `Ctrl+L`      | Clear all logs                 |
| `Ctrl+E`      | Export JSON                    |
| `↑` / `↓`    | Navigate rows in log list      |
