<script lang="ts">
	import './layout.css'
	import { ciphClient } from '@ciph/svelte'
	import CiphDevtoolsPanel from '../../../../packages/svelte/src/devtools/CiphDevtoolsPanel.svelte'

	let { children } = $props()

	// Initialize Ciph client - use demo secret for testing
	const { client, fingerprintStore, errorStore, isEncryptingStore } = ciphClient({
		baseURL: 'http://localhost:5173',
		secret: 'test-secret-key-must-be-at-least-32-characters-long!',
		excludeRoutes: ['/health'],
	})

	// Export for use in child routes
	export { client, fingerprintStore, errorStore, isEncryptingStore }
</script>

<div class="layout">
	<header>
		<h1>Ciph Svelte Demo</h1>
		<p>Transparent HTTP Encryption for SvelteKit</p>
	</header>

	{@render children()}

	<!-- Ciph DevTools Panel (visible only in dev, Ctrl+Shift+C to toggle) -->
	<CiphDevtoolsPanel position="bottom-right" defaultOpen={false} maxLogs={100} />

	<footer>
		<p>Fingerprint: {$fingerprintStore ? $fingerprintStore.substring(0, 12) + '...' : 'Loading...'}</p>
		{#if $errorStore}
			<p style="color: #ff6b6b;">Error: {$errorStore}</p>
		{/if}
	</footer>
</div>

<style>
	:global(body) {
		font-family: system-ui, -apple-system, sans-serif;
		margin: 0;
		padding: 0;
		background: #0f0f0f;
		color: #e0e0e0;
	}

	:global(button) {
		background: #007acc;
		color: white;
		border: none;
		padding: 10px 20px;
		border-radius: 4px;
		cursor: pointer;
		font-size: 14px;
		transition: background 0.2s;
	}

	:global(button:hover) {
		background: #005a9e;
	}

	:global(input, textarea) {
		background: #1e1e1e;
		color: #e0e0e0;
		border: 1px solid #404040;
		padding: 8px 12px;
		border-radius: 4px;
		font-family: 'Courier New', monospace;
		font-size: 14px;
	}

	.layout {
		max-width: 1200px;
		margin: 0 auto;
		padding: 20px;
	}

	header {
		border-bottom: 2px solid #404040;
		padding-bottom: 20px;
		margin-bottom: 40px;
	}

	header h1 {
		margin: 0;
		font-size: 28px;
		color: #4ec9b0;
	}

	header p {
		color: #858585;
		margin: 8px 0 0 0;
	}

	footer {
		border-top: 2px solid #404040;
		padding-top: 20px;
		margin-top: 60px;
		font-size: 12px;
		color: #858585;
	}
</style>
