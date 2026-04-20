<script lang="ts">
	import type { ApiResponse, Employee, Status } from './types'
	import { onMount } from 'svelte'
	import { page } from '$app/stores'

	let response = $state<ApiResponse | null>(null)
	let loading = $state(false)
	let status = $state<Status>('idle')
	let employees = $state<Employee[]>([])
	let empLoading = $state(false)
	let empError = $state<string | null>(null)
	let ciph: any = null

	onMount(async () => {
		// Import ciph client
		const { ciphClient } = await import('@ciph/svelte')
		ciph = ciphClient({
			baseURL: 'http://localhost:3000',
			secret: import.meta.env.VITE_CIPH_SECRET,
		})

		// Load employees on mount
		await fetchEmployees()
	})

	async function testCiph() {
		if (!ciph) return
		loading = true
		response = null
		status = 'idle'
		try {
			const res = await ciph.post('/api/echo', {
				message: 'Hello from Ciph v2 (AES-256-GCM)!',
				timestamp: new Date().toISOString(),
			})
			response = res.data
			status = 'success'
		} catch (error) {
			response = { error: (error as Error).message || 'Request failed' }
			status = 'error'
		}
		loading = false
	}

	async function fetchEmployees() {
		if (!ciph) return
		empLoading = true
		empError = null
		try {
			const res = await ciph.get('/api/employees')
			employees = res.data.data || []
		} catch (error) {
			empError = (error as Error).message || 'Failed to fetch employees'
		}
		empLoading = false
	}
</script>

<svelte:head>
	<title>Ciph - Encrypted HTTP</title>
</svelte:head>

<main>
	<section id="center">
		<div class="hero">
			<svg
				class="base"
				viewBox="0 0 170 179"
				width="170"
				height="179"
				xmlns="http://www.w3.org/2000/svg"
			>
				<circle cx="85" cy="89.5" r="85" fill="#0f1117" stroke="#30363d" stroke-width="2" />
				<text
					x="50%"
					y="50%"
					dominant-baseline="middle"
					text-anchor="middle"
					font-size="80"
					font-weight="bold"
					fill="#58a6ff"
				>
					🔐
				</text>
			</svg>
			<svg
				class="framework"
				viewBox="0 0 155 58"
				xmlns="http://www.w3.org/2000/svg"
				width="60"
				height="58"
			>
				<text x="10" y="40" font-size="32" fill="#4ec9b0" font-weight="bold">Svelte</text>
			</svg>
			<svg
				class="vite"
				viewBox="0 0 410 404"
				xmlns="http://www.w3.org/2000/svg"
				width="40"
				height="40"
			>
				<defs>
					<linearGradient id="paint0_linear" x1="-.5" y1="-.5" x2="1" y2="1">
						<stop offset="0" stop-color="#fd6e6e" />
						<stop offset="1" stop-color="#ff8c42" />
					</linearGradient>
				</defs>
				<path
					d="M372.5 150L202.8 13.5a20 20 0 00-35.6 0L7.5 150c-10.3 17.9 2.6 39.4 23 40l148 2.5 148-2.5c20.4-.6 33.3-22.1 23-40z"
					fill="url(#paint0_linear)"
				/>
			</svg>
		</div>

		<div style="text-align: center;">
			<h1>Ciph Example</h1>
			<p style="color: var(--text-2); margin-bottom: 24px; font-size: 16px;">
				Click the button to send an encrypted POST request to the backend.
				<br />
				Body is AES-256-GCM encrypted — plain text never touches the network.
				<br />
				<strong>👉 Open the DevTools floating panel (bottom-right) to inspect encrypted/decrypted payloads!</strong>
			</p>
			<button class="counter" onclick={testCiph} disabled={loading}>
				{loading ? '⏳ Encrypting...' : '🚀 Send Encrypted Message'}
			</button>
		</div>

		{#if status === 'success' && response}
			<div class="response-card success">
				<div class="response-header">✓ Success</div>
				<pre class="response-body">{JSON.stringify(response, null, 2)}</pre>
			</div>
		{:else if status === 'error' && response?.error}
			<div class="response-card error">
				<div class="response-header">✗ Error</div>
				<pre class="response-body">{response.error}</pre>
			</div>
		{/if}
	</section>

	<section id="next-steps">
		<div id="docs">
			<h3>📚 Documentation</h3>
			<p>Ciph transparently encrypts HTTP request/response bodies. Zero code changes for fetches, just add the middleware.</p>
			<p><strong>Features:</strong></p>
			<ul style="list-style: disc; margin-left: 20px;">
				<li>AES-256-GCM encryption (authenticated + secure)</li>
				<li>Device fingerprinting via HKDF</li>
				<li>Automatic request/response interception</li>
				<li>Real-time devtools logging (inspect encrypted data)</li>
				<li>Zero dependency crypto library (@ciph/core)</li>
			</ul>
		</div>

		<div id="network">
			<h3>🔍 DevTools Inspector</h3>
			<p><strong>Now visible:</strong> Open the floating panel (bottom-right) to see:</p>
			<ul style="list-style: disc; margin-left: 20px;">
				<li>All encrypted/decrypted request & response bodies</li>
				<li>HTTP method, route, status, duration</li>
				<li>Device fingerprint hash</li>
				<li>Color-coded status indicators</li>
			</ul>
			<button class="link-btn" onclick={() => window.open('/docs', '_blank')}
				>→ Read Full Docs</button
			>
		</div>
	</section>

	{#if employees.length > 0}
		<section id="employees">
			<h2>📊 Encrypted Employee Data (loaded automatically)</h2>
			<div class="table-wrapper">
				<table>
					<thead>
						<tr>
							<th>ID</th>
							<th>Name</th>
							<th>Role</th>
							<th>Department</th>
							<th>Salary</th>
							<th>Status</th>
						</tr>
					</thead>
					<tbody>
						{#each employees as emp (emp.id)}
							<tr>
								<td>{emp.id}</td>
								<td>{emp.name}</td>
								<td>{emp.role}</td>
								<td>{emp.dept}</td>
								<td>${emp.salary.toLocaleString()}</td>
								<td class:active={emp.status === 'active'} class:inactive={emp.status === 'inactive'}>
									{emp.status}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			<p style="color: var(--text-2); font-size: 12px; margin-top: 12px;">
				💡 <strong>Pro tip:</strong> This data was encrypted in transit! Check the Ciph DevTools panel to see the encrypted
				payload.
			</p>
		</section>
	{/if}
</main>

<style>
	:global(body) {
		--accent: #58a6ff;
		--accent-bg: #0d2b45;
		--accent-border: #1f6feb;
		--text-h: #e6edf3;
		--text-1: #c9d1d9;
		--text-2: #8b949e;
		--border: #30363d;
		--bg: #0d1117;
		--shadow: 0 8px 24px rgba(9, 105, 218, 0.2);
		--social-bg: #161b22;
	}

	main {
		display: flex;
		flex-direction: column;
		min-height: 100vh;
		gap: 0;
	}

	#center {
		display: flex;
		flex-direction: column;
		gap: 25px;
		place-content: center;
		place-items: center;
		flex-grow: 1;
		padding: 32px 20px;
	}

	.hero {
		position: relative;
		width: 170px;
		height: 179px;
		margin-bottom: 20px;
	}

	.hero .base,
	.hero .framework,
	.hero .vite {
		inset-inline: 0;
		margin: 0 auto;
	}

	.hero .base {
		width: 170px;
		position: relative;
		z-index: 0;
	}

	.hero .framework,
	.hero .vite {
		position: absolute;
	}

	.hero .framework {
		z-index: 1;
		top: 34px;
		height: 28px;
		transform: perspective(2000px) rotateZ(300deg) rotateX(44deg) rotateY(39deg) scale(1.4);
	}

	.hero .vite {
		z-index: 0;
		top: 107px;
		height: 26px;
		width: auto;
		transform: perspective(2000px) rotateZ(300deg) rotateX(40deg) rotateY(39deg) scale(0.8);
	}

	h1 {
		font-size: 2.5em;
		margin: 0;
		color: var(--text-h);
	}

	.counter {
		font-size: 16px;
		padding: 12px 24px;
		border-radius: 8px;
		color: var(--accent);
		background: var(--accent-bg);
		border: 2px solid var(--accent-border);
		cursor: pointer;
		font-weight: 600;
		transition: all 0.3s ease;
	}

	.counter:hover:not(:disabled) {
		background: #1f6feb;
		box-shadow: var(--shadow);
		transform: translateY(-2px);
	}

	.counter:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.response-card {
		width: 100%;
		max-width: 600px;
		border-radius: 8px;
		overflow: hidden;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
	}

	.response-card.success {
		background: #0d2817;
		border: 1px solid #238636;
	}

	.response-card.error {
		background: #3d2222;
		border: 1px solid #da3633;
	}

	.response-header {
		padding: 12px 16px;
		font-weight: 600;
		font-size: 14px;
		border-bottom: 1px solid;
	}

	.response-card.success .response-header {
		border-color: #238636;
		color: #3fb950;
		background: rgba(63, 185, 80, 0.1);
	}

	.response-card.error .response-header {
		border-color: #da3633;
		color: #f85149;
		background: rgba(248, 81, 73, 0.1);
	}

	.response-body {
		padding: 16px;
		margin: 0;
		overflow-x: auto;
		font-size: 12px;
		font-family: 'Menlo', 'Monaco', 'Consolas', monospace;
		color: var(--text-1);
		background: #0d1117;
	}

	#next-steps {
		display: flex;
		border-top: 1px solid var(--border);
		text-align: left;
	}

	#next-steps > div {
		flex: 1;
		padding: 32px;
		border-right: 1px solid var(--border);
	}

	#next-steps > div:last-child {
		border-right: none;
	}

	#next-steps h3 {
		margin: 0 0 12px 0;
		color: var(--text-h);
		font-size: 18px;
	}

	#next-steps p {
		color: var(--text-2);
		font-size: 14px;
		line-height: 1.6;
		margin: 0 0 12px 0;
	}

	#next-steps ul {
		list-style: none;
		padding: 0;
		margin: 0;
		color: var(--text-2);
	}

	#next-steps li {
		padding: 4px 0;
		font-size: 14px;
	}

	.link-btn {
		margin-top: 16px;
		padding: 8px 16px;
		background: var(--accent-bg);
		border: 1px solid var(--accent);
		color: var(--accent);
		border-radius: 6px;
		cursor: pointer;
		font-size: 14px;
		font-weight: 600;
		transition: all 0.2s;
	}

	.link-btn:hover {
		background: var(--accent);
		color: var(--bg);
	}

	#employees {
		padding: 32px;
		border-top: 1px solid var(--border);
	}

	#employees h2 {
		margin: 0 0 20px 0;
		color: var(--text-h);
	}

	.table-wrapper {
		overflow-x: auto;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 14px;
	}

	table thead {
		background: var(--social-bg);
		border-bottom: 2px solid var(--border);
	}

	table th {
		padding: 12px;
		text-align: left;
		color: var(--text-h);
		font-weight: 600;
		border-right: 1px solid var(--border);
	}

	table th:last-child {
		border-right: none;
	}

	table td {
		padding: 12px;
		color: var(--text-2);
		border-bottom: 1px solid var(--border);
		border-right: 1px solid var(--border);
	}

	table td:last-child {
		border-right: none;
	}

	table tr:hover {
		background: var(--social-bg);
	}

	table td.active {
		color: #3fb950;
		font-weight: 600;
	}

	table td.inactive {
		color: #d1242f;
	}

	@media (max-width: 1024px) {
		#center {
			padding: 32px 20px 24px;
			gap: 18px;
		}

		#next-steps {
			flex-direction: column;
			text-align: center;
		}

		#next-steps > div {
			flex: 1;
			padding: 24px 20px;
			border-right: none;
			border-bottom: 1px solid var(--border);
		}

		#next-steps > div:last-child {
			border-bottom: none;
		}

		#employees {
			padding: 24px 20px;
		}
	}
</style>
