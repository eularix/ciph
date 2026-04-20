// SvelteKit server hooks with Ciph encryption
import type { Handle } from '@sveltejs/kit'
import { ciphHooks } from '@ciph/svelte'

// For demo: generate test keys or use env vars
const CIPH_PRIVATE_KEY = process.env.CIPH_PRIVATE_KEY || 'test-private-key-32-chars-minimum!!'

export const handle: Handle = ciphHooks({
	privateKey: CIPH_PRIVATE_KEY,
	excludeRoutes: ['/health', '/ciph'],
	devtools: {
		enabled: process.env.NODE_ENV === 'development',
	},
})
