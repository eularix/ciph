// Test API endpoint for Ciph encryption demo
import type { RequestHandler } from '@sveltejs/kit'

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json()
		
		return new Response(
			JSON.stringify({
				success: true,
				message: 'Echo test successful',
				received: body,
				timestamp: new Date().toISOString(),
			}),
			{
				status: 200,
				headers: {
					'Content-Type': 'application/json',
				},
			}
		)
	} catch (error) {
		return new Response(
			JSON.stringify({
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error',
			}),
			{
				status: 500,
				headers: {
					'Content-Type': 'application/json',
				},
			}
		)
	}
}
