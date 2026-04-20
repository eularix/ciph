<script lang="ts">
  import { onMount } from 'svelte'
  import { getCiphClientEmitter } from './emitter'
  import type { CiphClientLog } from '@ciph/core'

  interface Log extends CiphClientLog {
    id: string
  }

  interface Props {
    position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
    defaultOpen?: boolean
    maxLogs?: number
    shortcut?: string | null
    disabled?: boolean
  }

  let {
    position = 'bottom-right',
    defaultOpen = false,
    maxLogs = 100,
    shortcut = 'ctrl+shift+c',
    disabled = false,
  }: Props = $props()

  let logs = $state<Log[]>([])
  let selectedId = $state<string | null>(null)
  let isOpen = $state(defaultOpen)
  let isDragging = $state(false)
  let dragOffset = $state({ x: 0, y: 0 })
  let panelElement: HTMLDivElement | undefined

  let selectedLog = $derived(logs.find((l) => l.id === selectedId) || null)

  onMount(() => {
    if (disabled) return

    const emitter = getCiphClientEmitter()
    if (!emitter) return

    const unsubscribe = emitter.on('log', (log: CiphClientLog) => {
      const newLog: Log = {
        ...log,
        id: `${Date.now()}-${Math.random()}`,
      }

      logs = [newLog, ...logs]
      if (logs.length > maxLogs) {
        logs = logs.slice(0, maxLogs)
      }
    })

    if (shortcut) {
      const [ctrl, shift, key] = shortcut.toLowerCase().split('+')
      const handleKeyDown = (e: KeyboardEvent) => {
        const isCtrl = ctrl === 'ctrl' ? e.ctrlKey : e.metaKey
        const isShift = shift === 'shift' ? e.shiftKey : false
        const keyMatch = key === 'c' ? e.code === 'KeyC' : e.key.toLowerCase() === key

        if (isCtrl && isShift && keyMatch) {
          e.preventDefault()
          isOpen = !isOpen
        }
      }

      window.addEventListener('keydown', handleKeyDown)

      return () => {
        window.removeEventListener('keydown', handleKeyDown)
        unsubscribe?.()
      }
    }

    return () => {
      unsubscribe?.()
    }
  })

  function handleDragStart(e: MouseEvent) {
    if (!panelElement) return
    isDragging = true
    const rect = panelElement.getBoundingClientRect()
    dragOffset = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    }
  }

  function handleDragMove(e: MouseEvent) {
    if (isDragging && panelElement) {
      panelElement.style.left = e.clientX - dragOffset.x + 'px'
      panelElement.style.top = e.clientY - dragOffset.y + 'px'
    }
  }

  function handleDragEnd() {
    isDragging = false
  }

  function clearLogs() {
    logs = []
    selectedId = null
  }

  function methodColor(method: string): { bg: string; text: string } {
    const colors: Record<string, { bg: string; text: string }> = {
      GET: { bg: '#58a6ff', text: '#0f1117' },
      POST: { bg: '#3fb950', text: '#0f1117' },
      PUT: { bg: '#d29922', text: '#0f1117' },
      PATCH: { bg: '#bc8cff', text: '#0f1117' },
      DELETE: { bg: '#f85149', text: '#0f1117' },
    }
    return colors[method] || { bg: '#8b949e', text: '#0f1117' }
  }

  function statusColor(status: number): string {
    if (status >= 200 && status < 300) return '#3fb950'
    if (status >= 300 && status < 400) return '#d29922'
    return '#f85149'
  }

  function fmtBody(v: any): string {
    if (!v) return 'null'
    if (typeof v === 'string') return v
    try {
      return JSON.stringify(v, null, 2)
    } catch {
      return String(v)
    }
  }

  function trunc(s: string | null | undefined): string {
    if (!s) return '—'
    return s.length > 120 ? s.slice(0, 120) + '…' : s
  }
</script>

<svelte:window on:mousemove={handleDragMove} on:mouseup={handleDragEnd} />

{#if import.meta.env.MODE === 'development'}
  <!-- Pill-shaped button (matches React) -->
  <button
    class="ciph-button"
    class:bottom-right={position === 'bottom-right'}
    class:bottom-left={position === 'bottom-left'}
    class:top-right={position === 'top-right'}
    class:top-left={position === 'top-left'}
    on:click={() => (isOpen = !isOpen)}
    title={isOpen ? 'Close DevTools' : 'Open DevTools (Ctrl+Shift+C)'}
  >
    🛡️ Ciph Inspector
  </button>

  <!-- Panel (opens below/behind button) -->
  {#if isOpen}
    <div
      class="ciph-panel"
      class:bottom-right={position === 'bottom-right'}
      class:bottom-left={position === 'bottom-left'}
      class:top-right={position === 'top-right'}
      class:top-left={position === 'top-left'}
      bind:this={panelElement}
      on:mousedown={handleDragStart}
    >
      <div class="ciph-header" role="button" tabindex="0">
        <span class="ciph-title">Ciph Inspector</span>
        <span class="ciph-count">{logs.length}</span>
        <div style="flex: 1;"></div>
        <button on:click={clearLogs} class="ciph-btn" title="Clear"> 🗑️ </button>
        <button on:click={() => (isOpen = false)} class="ciph-btn" title="Close">✕</button>
      </div>

      <div class="ciph-body">
        <div class="ciph-logs">
          <div class="ciph-logs-header">
            <span>Method</span>
            <span>Route</span>
            <span>Status</span>
            <span>ms</span>
          </div>

          {#if logs.length === 0}
            <div class="ciph-empty">
              No requests yet.<br />Trigger API calls to see logs.
            </div>
          {:else}
            {#each logs as log (log.id)}
              {@const mc = methodColor(log.method)}
              <button
                class="ciph-log-row"
                class:selected={selectedId === log.id}
                on:click={() => (selectedId = log.id)}
              >
                <span
                  class="method-badge"
                  style="background: {mc.bg}; color: {mc.text};"
                >
                  {log.method}
                </span>
                <span class="route-text">{log.route}</span>
                <span
                  class="status-text"
                  style="color: {statusColor(log.status)};"
                >
                  {log.status}
                </span>
                <span class="time-text">{log.duration}ms</span>
              </button>
            {/each}
          {/if}
        </div>

        <div class="ciph-detail">
          {#if !selectedLog}
            <div class="ciph-detail-empty">
              ← Select a request to inspect
            </div>
          {:else}
            {@const mc = methodColor(selectedLog.method)}
            <div class="ciph-detail-header">
              <span
                class="method-badge"
                style="background: {mc.bg}; color: {mc.text};"
              >
                {selectedLog.method}
              </span>
              <span class="route-detail">{selectedLog.route}</span>
              <span
                class="status-detail"
                style="color: {statusColor(selectedLog.status)};"
              >
                {selectedLog.status}
              </span>
              <span class="enc-badge">
                {#if selectedLog.excluded}
                  ○ Plain
                {:else}
                  🔒 Encrypted
                {/if}
              </span>
            </div>

            <div class="ciph-meta">
              <span>{selectedLog.timestamp}</span>
              <span>{selectedLog.duration}ms</span>
              {#if selectedLog.fingerprint.value}
                <span>fp: {selectedLog.fingerprint.value.slice(0, 16)}…</span>
              {/if}
            </div>

            <div class="ciph-bodies">
              <div class="ciph-body-col">
                <div class="ciph-body-label">Request (Plain)</div>
                <pre
                  class="ciph-body-content"
                >{fmtBody(selectedLog.request.plainBody)}</pre>
              </div>
              <div class="ciph-body-col">
                <div class="ciph-body-label">Response (Plain)</div>
                <pre
                  class="ciph-body-content"
                >{fmtBody(selectedLog.response.plainBody)}</pre>
              </div>
            </div>

            <div class="ciph-bodies">
              <div class="ciph-body-col">
                <div class="ciph-body-label ciph-enc">Request Encrypted</div>
                <pre
                  class="ciph-body-content enc"
                >{trunc(selectedLog.request.encryptedBody)}</pre>
              </div>
              <div class="ciph-body-col">
                <div class="ciph-body-label ciph-enc">Response Encrypted</div>
                <pre
                  class="ciph-body-content enc"
                >{trunc(selectedLog.response.encryptedBody)}</pre>
              </div>
            </div>
          {/if}
        </div>
      </div>
    </div>
  {/if}
{/if}

<style>
  :global(body) {
    --ciph-bg: #0f1117;
    --ciph-bg2: #161b22;
    --ciph-bg3: #1c2230;
    --ciph-border: #30363d;
    --ciph-text: #e6edf3;
    --ciph-text2: #8b949e;
  }

  /* Pill-shaped button (matches React) */
  .ciph-button {
    position: fixed;
    z-index: 9999;
    padding: 10px 16px;
    background: #111827;
    color: white;
    border-radius: 24px;
    border: none;
    cursor: pointer;
    box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
    font-weight: 600;
    font-size: 14px;
    font-family: system-ui, -apple-system, sans-serif;
    transition: all 0.2s ease;
    white-space: nowrap;
  }

  .ciph-button:hover {
    background: #1f2937;
    box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.2);
    transform: translateY(-2px);
  }

  .ciph-button:active {
    transform: translateY(0);
  }

  .ciph-button.bottom-right {
    bottom: 20px;
    right: 20px;
  }

  .ciph-button.bottom-left {
    bottom: 20px;
    left: 20px;
  }

  .ciph-button.top-right {
    top: 20px;
    right: 20px;
  }

  .ciph-button.top-left {
    top: 20px;
    left: 20px;
  }

  .ciph-panel {
    position: fixed;
    z-index: 999999;
    width: 700px;
    height: 600px;
    background: var(--ciph-bg);
    border: 1px solid var(--ciph-border);
    border-radius: 8px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    display: flex;
    flex-direction: column;
    font-family: 'Menlo', 'Monaco', 'Consolas', monospace;
    font-size: 13px;
    color: var(--ciph-text);
    overflow: hidden;
  }

  .ciph-panel.bottom-right {
    bottom: 20px;
    right: 20px;
  }

  .ciph-panel.bottom-left {
    bottom: 20px;
    left: 20px;
  }

  .ciph-panel.top-right {
    top: 20px;
    right: 20px;
  }

  .ciph-panel.top-left {
    top: 20px;
    left: 20px;
  }

  .ciph-header {
    background: var(--ciph-bg2);
    border-bottom: 1px solid var(--ciph-border);
    padding: 12px 16px;
    display: flex;
    align-items: center;
    gap: 12px;
    flex-shrink: 0;
    cursor: grab;
    user-select: none;
  }

  .ciph-header:active {
    cursor: grabbing;
  }

  .ciph-title {
    font-size: 13px;
    font-weight: 700;
    letter-spacing: -0.5px;
  }

  .ciph-count {
    font-size: 11px;
    background: var(--ciph-bg3);
    border: 1px solid var(--ciph-border);
    border-radius: 10px;
    padding: 2px 8px;
    color: var(--ciph-text2);
  }

  .ciph-btn {
    padding: 4px 8px;
    border-radius: 4px;
    border: 1px solid var(--ciph-border);
    background: var(--ciph-bg3);
    color: var(--ciph-text2);
    cursor: pointer;
    font-size: 12px;
    font-family: inherit;
    transition: all 0.2s ease;
  }

  .ciph-btn:hover {
    border-color: var(--ciph-text2);
    color: var(--ciph-text);
  }

  .ciph-body {
    display: flex;
    flex: 1;
    overflow: hidden;
    min-height: 0;
  }

  .ciph-logs {
    width: 280px;
    border-right: 1px solid var(--ciph-border);
    overflow-y: auto;
    flex-shrink: 0;
  }

  .ciph-logs-header {
    position: sticky;
    top: 0;
    background: var(--ciph-bg2);
    border-bottom: 1px solid var(--ciph-border);
    padding: 8px 12px;
    display: grid;
    grid-template-columns: 60px 1fr 50px 46px;
    gap: 8px;
    color: var(--ciph-text2);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    font-weight: 600;
  }

  .ciph-empty {
    padding: 20px;
    text-align: center;
    color: var(--ciph-text2);
    line-height: 1.5;
    font-size: 12px;
  }

  .ciph-log-row {
    width: 100%;
    padding: 9px 12px;
    display: grid;
    grid-template-columns: 60px 1fr 50px 46px;
    gap: 8px;
    border: none;
    border-bottom: 1px solid var(--ciph-border);
    border-left: 2px solid transparent;
    background: transparent;
    color: var(--ciph-text);
    cursor: pointer;
    align-items: center;
    font-family: inherit;
    font-size: 12px;
    transition: all 0.15s ease;
  }

  .ciph-log-row:hover {
    background: var(--ciph-bg3);
  }

  .ciph-log-row.selected {
    background: var(--ciph-bg3);
    border-left-color: #58a6ff;
  }

  .method-badge {
    font-size: 10px;
    font-weight: 700;
    padding: 2px 4px;
    border-radius: 4px;
    text-align: center;
  }

  .route-text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 12px;
  }

  .status-text {
    font-weight: 600;
    font-size: 12px;
  }

  .time-text {
    text-align: right;
    font-size: 11px;
    color: var(--ciph-text2);
  }

  .ciph-detail {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }

  .ciph-detail-empty {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--ciph-text2);
    font-size: 13px;
  }

  .ciph-detail-header {
    display: flex;
    gap: 8px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--ciph-border);
    background: var(--ciph-bg2);
    align-items: center;
    flex-wrap: wrap;
  }

  .route-detail {
    flex: 1;
    font-size: 12px;
    color: var(--ciph-text);
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .status-detail {
    font-weight: 600;
    font-size: 12px;
  }

  .enc-badge {
    font-size: 11px;
    background: var(--ciph-bg3);
    border: 1px solid var(--ciph-border);
    border-radius: 4px;
    padding: 2px 6px;
    color: var(--ciph-text2);
  }

  .ciph-meta {
    display: flex;
    gap: 16px;
    padding: 8px 16px;
    background: var(--ciph-bg);
    border-bottom: 1px solid var(--ciph-border);
    font-size: 11px;
    color: var(--ciph-text2);
  }

  .ciph-meta span {
    white-space: nowrap;
  }

  .ciph-bodies {
    display: flex;
    gap: 12px;
    padding: 12px 16px;
    flex: 1;
    overflow: hidden;
    min-height: 0;
  }

  .ciph-body-col {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-height: 0;
  }

  .ciph-body-label {
    font-size: 11px;
    font-weight: 700;
    color: var(--ciph-text2);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 8px;
    font-weight: 600;
  }

  .ciph-body-label.ciph-enc {
    color: #58a6ff;
  }

  .ciph-body-content {
    margin: 0;
    background: var(--ciph-bg2);
    border: 1px solid var(--ciph-border);
    border-radius: 6px;
    padding: 12px;
    color: var(--ciph-text);
    font-size: 12px;
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-all;
    overflow-x: auto;
    max-height: 120px;
    flex: 1;
  }

  .ciph-body-content.enc {
    color: var(--ciph-text2);
  }
</style>
