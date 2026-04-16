# UI Specification — @ciph/devtools-client

## Floating Button

```
┌─────────────────────────────────────────────────────────┐
│                                          (viewport)      │
│                                                          │
│                                                          │
│                                  ┌──────────────────┐   │
│                                  │  🔒 Ciph  3      │   │
│                                  └──────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

- **Icon:** lock emoji or SVG lock icon
- **Label:** "Ciph"
- **Badge:** count of logs since panel was last opened (resets on open)
- **Position:** draggable, persists position in `sessionStorage`
- **Click:** toggles panel open/close

---

## Panel Layout

```
┌──────────────────────────────────────────────────────────────┐
│  🔒 Ciph DevTools                       [Clear]  [✕ Close]  │
├──────────────────────────────────────────────────────────────┤
│  METHOD │ ROUTE                    │ STATUS │ TIME │ ENC     │
├─────────┼──────────────────────────┼────────┼──────┼─────────┤
│  POST   │ /employees               │  201   │ 34ms │  🔒     │
│  GET    │ /materials-list          │  200   │ 12ms │  🔒     │
│  PATCH  │ /employees/abc-123       │  200   │  8ms │  🔒     │
│  GET    │ /health                  │  200   │  2ms │  ○      │
└─────────┴──────────────────────────┴────────┴──────┴─────────┘
           ↓ click a row
```

### Columns

| Column   | Content                                                       |
|----------|---------------------------------------------------------------|
| METHOD   | HTTP method badge — color-coded (GET=blue, POST=green, etc.)  |
| ROUTE    | Request URL path (without baseURL)                            |
| STATUS   | HTTP status code — color-coded (2xx=green, 4xx=red, 5xx=red)  |
| TIME     | Duration in ms from request sent to response decrypted        |
| ENC      | 🔒 if encrypted, ○ if excluded/plain                          |

### Row Behavior

- Latest log appears at the **top**
- Rows are clickable — opens detail panel
- Error rows (4xx/5xx) highlighted in red tint
- Ciph error rows (CIPH001–CIPH006) highlighted with distinct color

---

## Detail Panel (on row click)

Panel expands below or alongside the log list:

```
┌───────────────────────────────────────────────────────────────────┐
│  POST /employees   201   34ms   🔒 Encrypted                      │
├────────────────────────┬──────────────────────────────────────────┤
│  REQUEST               │  RESPONSE                                │
├────────────────────────┼──────────────────────────────────────────┤
│  Plain Body            │  Plain Body                              │
│  {                     │  {                                       │
│    "name": "Dimas",    │    "data": {                             │
│    "role": "engineer", │      "id": "abc-123",                    │
│    "salary": 15000000  │      "name": "Dimas",                    │
│  }                     │      "createdAt": "2026-04-16"           │
│                        │    }                                     │
│  ──────────────        │  }                                       │
│  Encrypted Body        │                                          │
│  aB3kX9mLp2...         │  Encrypted Body                          │
│  [truncated, copy btn] │  cD7nY4qRs8...                           │
│                        │  [truncated, copy btn]                   │
├────────────────────────┴──────────────────────────────────────────┤
│  HEADERS                                                          │
│  X-Fingerprint: aB3k... (encrypted)                               │
│  Content-Type: text/plain                                         │
│  Authorization: Bearer eyJ... (passthrough, unchanged by Ciph)   │
├───────────────────────────────────────────────────────────────────┤
│  FINGERPRINT                                                       │
│  Value:   a3f8b2c9...  (truncated)                                │
│  Cached:  ✅ Yes                                                  │
│  Retried: ❌ No                                                   │
└───────────────────────────────────────────────────────────────────┘
```

### Tabs in Detail Panel

| Tab           | Content                                          |
|---------------|--------------------------------------------------|
| Request       | Plain body + encrypted body (collapsed) + headers |
| Response      | Plain body + encrypted body (collapsed)           |
| Fingerprint   | Hash value, cached status, mismatch retry flag    |

### Copy Button

Each encrypted body section has a **Copy** button to copy the raw ciphertext to clipboard. Useful for manual debugging.

---

## Panel Behavior

| Behavior                   | Detail                                               |
|----------------------------|------------------------------------------------------|
| Draggable                  | Drag from the header bar — free position on screen   |
| Resizable                  | Drag bottom-right corner to resize                   |
| Default size               | 700px × 400px                                        |
| Min size                   | 400px × 250px                                        |
| Scroll                     | Log list scrolls independently from detail view      |
| Auto-scroll                | New logs auto-scroll to top of list                  |
| Clear button               | Clears all logs from memory                          |
| Keyboard shortcut          | `Ctrl+Shift+C` (configurable) — toggle open/close    |
| Z-index                    | 9999 — always on top                                 |
| Dark mode                  | Follows `prefers-color-scheme` system setting        |
