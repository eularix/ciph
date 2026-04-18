# @ciph/devtools-client

Floating React devtools panel for Ciph encryption debugging. Shows encrypted/decrypted request/response logs in browser.

## Features

- **Floating panel** — Draggable, resizable, toggleable
- **Request/response logs** — Full encryption details visible
- **Decrypted bodies** — See plaintext before encryption
- **Encrypted bodies** — View ciphertext (base64url)
- **Headers & fingerprint** — Request metadata
- **Keyboard shortcut** — Toggle with `Ctrl+Shift+C` (customizable)
- **Circular buffer** — Max 100 logs default
- **Production safe** — Tree-shaken, zero bytes in prod bundle
- **Dev only** — Returns `null` in production

## Install

```bash
npm install @ciph/devtools-client @ciph/react
# or
pnpm add @ciph/devtools-client @ciph/react
```

## Quick Start

```typescript
// App.tsx
import { CiphDevtools } from '@ciph/devtools-client'

function App() {
  return (
    <>
      <YourApp />
      <CiphDevtools />
    </>
  )
}

export default App
```

That's it. Panel appears in bottom-right corner.

## Props

```typescript
interface CiphDevtoolsProps {
  // Position on screen
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
  // default: 'bottom-right'

  // Open by default
  defaultOpen?: boolean
  // default: false

  // Max logs to keep (circular buffer)
  maxLogs?: number
  // default: 100

  // Keyboard shortcut to toggle
  shortcut?: string | null
  // default: 'ctrl+shift+c'
  // Set to null to disable

  // Completely disable devtools
  disabled?: boolean
  // default: false
}
```

## Usage

```typescript
import { CiphDevtools } from '@ciph/devtools-client'

// Default (bottom-right, Ctrl+Shift+C to toggle)
<CiphDevtools />

// Customized
<CiphDevtools
  position="top-left"
  defaultOpen={true}
  maxLogs={50}
  shortcut="shift+d"
  disabled={process.env.NODE_ENV === 'production'}
/>

// No shortcut
<CiphDevtools shortcut={null} />
```

## Panel Features

### Log List
Shows all requests in order (newest first):
- **METHOD** — GET, POST, PUT, PATCH, DELETE
- **ROUTE** — Request path
- **STATUS** — HTTP status code (or pending)
- **TIME** — Request time
- **SIZE** — Ciphertext size
- **ENC** — Encrypted (✓ or ✗)

### Detail View
Click any log to see:
- **Decrypted Body** — Plain JSON/text
- **Encrypted Body** — Base64url ciphertext (truncated, copy button)
- **Headers** — X-Fingerprint, Content-Type, etc.
- **Fingerprint** — Device fingerprint hash
- **Timing** — Start time, duration

### Controls
- **Drag header** — Move panel
- **Resize handle** (bottom-right) — Resize panel
- **Clear button** — Delete all logs
- **Close button** — Hide panel
- **Toggle button** — Keyboard shortcut or click

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+C` | Toggle panel (default) |
| Customize | `shortcut="key-combo"` prop |
| Disable | `shortcut={null}` |

Supported combos:
- `ctrl+`, `shift+`, `alt+`, `cmd+` (Mac)
- Single keys or combinations
- Examples: `ctrl+d`, `shift+alt+i`, `cmd+,`

---

## Examples

### Basic setup

```typescript
import { CiphDevtools } from '@ciph/devtools-client'

function App() {
  return (
    <>
      <MyApp />
      <CiphDevtools />
    </>
  )
}
```

### Conditional rendering

```typescript
function App() {
  return (
    <>
      <MyApp />
      {process.env.NODE_ENV === 'development' && <CiphDevtools />}
    </>
  )
}
```

### Custom styling position

```typescript
<CiphDevtools
  position="bottom-left"
  defaultOpen={false}
  maxLogs={200}
/>
```

### With theme provider

```typescript
function App() {
  return (
    <ThemeProvider>
      <MyApp />
      <CiphDevtools
        position="top-right"
        shortcut="shift+d"
      />
    </ThemeProvider>
  )
}
```

### React Router example

```typescript
import { CiphDevtools } from '@ciph/devtools-client'
import { createBrowserRouter } from 'react-router-dom'

const Layout = () => (
  <>
    <Outlet />
    <CiphDevtools />
  </>
)

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/about', element: <About /> },
    ],
  },
])
```

---

## Log Data Structure

Each log shows:

```typescript
interface CiphClientLog {
  method: string                    // "GET", "POST", etc.
  path: string                      // "/api/data"
  status?: number                   // 200, 404, etc.
  statusText?: string               // "OK", "Not Found"
  
  // Request
  requestBody?: string              // Original plaintext
  requestEncrypted?: string         // Base64url ciphertext
  
  // Response
  responseBody?: string             // Decrypted response
  responseEncrypted?: string        // Base64url ciphertext
  
  // Headers & metadata
  headers?: Record<string, string>
  fingerprint?: string              // Fingerprint hash
  
  timestamp: number                 // When request started
  duration?: number                 // ms
  
  // Errors
  error?: {
    code: string                    // "CIPH003", etc.
    message: string
  }
}
```

---

## Storage & Cleanup

- **Storage:** In-memory only (not localStorage)
- **Lifetime:** Tab lifetime
- **Buffer:** Circular (max N logs, older logs dropped)
- **On close:** All logs cleared when tab closes

---

## Performance

- **Panel rendering** — ~1-2ms per log
- **Keyboard listener** — Negligible
- **Memory usage** — ~1-2KB per log (100 logs = ~200KB)
- **No network calls** — Purely client-side

---

## Security

- **No data sent elsewhere** — All logs local
- **Tab-lifetime only** — Cleared on close
- **Dev only** — Returns `null` in production
- **No localStorage** — Can't be inspected by localStorage tools
- **Plaintext visibility** — ⚠️ Shows decrypted bodies in DevTools panel

---

## Production Safety

Component tree-shaken by bundler in production:

```typescript
// Development
import { CiphDevtools } from '@ciph/devtools-client'
<CiphDevtools />
// ✅ Component rendered, adds ~5KB gzipped

// Production
import { CiphDevtools } from '@ciph/devtools-client'
<CiphDevtools />
// ✅ Entire component removed by bundler, zero bytes
```

Verified via:
1. `process.env.NODE_ENV === 'development'` checks in component
2. Unused code elimination (webpack/vite)
3. `// @deprecated` markers on prod builds

---

## Styling

Panel uses CSS custom properties for theming:

```css
/* Override default styles */
:root {
  --ciph-panel-bg: #fff;
  --ciph-panel-border: #ddd;
  --ciph-panel-text: #000;
  --ciph-panel-hover: #f5f5f5;
}
```

---

## Troubleshooting

### Panel not showing
**Check:**
1. `<CiphDevtools />` added to App?
2. Not in production build?
3. Not disabled with `disabled={true}`?

### Shortcut not working
**Check:**
1. Typo in `shortcut` prop?
2. Conflicting browser/OS shortcut?
3. Try different key combo

### Logs not appearing
**Check:**
1. Requests being made with `@ciph/react`?
2. Routes not excluded?
3. Browser DevTools Network tab shows requests?

### Panel frozen/slow
**Check:**
1. Too many logs? (max with `maxLogs`)
2. Browser memory low?
3. Developer Tools open (can slow rendering)?

---

## API

### `<CiphDevtools />`

React component. Renders floating panel.

**Props:**
```typescript
interface CiphDevtoolsProps {
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
  defaultOpen?: boolean
  maxLogs?: number
  shortcut?: string | null
  disabled?: boolean
}
```

**Returns:** React.ReactElement | null (null in production)

---

## TypeScript

Full types included.

```typescript
import type { CiphClientLog } from '@ciph/core'
import { CiphDevtools } from '@ciph/devtools-client'
```

---

## License

MIT
