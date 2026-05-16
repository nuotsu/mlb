import { getPostHogClient } from '$lib/server/posthog.js'
import { createMcpServer } from '$lib/mcp/server.js'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { env } from '$env/dynamic/private'
import type { RequestHandler } from './$types'

export const config = {
	runtime: 'nodejs22.x',
}

const CORS = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'POST, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization',
	'Access-Control-Max-Age': '86400',
}

function withCors(response: Response): Response {
	const headers = new Headers(response.headers)
	for (const [k, v] of Object.entries(CORS)) headers.set(k, v)
	return new Response(response.body, { status: response.status, headers })
}

function unauthorized(): Response {
	return withCors(
		new Response('Unauthorized', {
			status: 401,
			headers: { 'Cache-Control': 'no-store' },
		}),
	)
}

function checkAuthorized(request: Request): Response | null {
	const secret = env.MCP_SECRET
	if (!secret) return null
	const auth = request.headers.get('authorization')
	if (auth === `Bearer ${secret}`) return null
	return unauthorized()
}

export const OPTIONS: RequestHandler = () => new Response(null, { status: 204, headers: CORS })

/** SSE GET holds connections until Vercel timeout; use POST-only or local stdio MCP. */
export const GET: RequestHandler = () =>
	withCors(
		new Response('MCP SSE is disabled on the hosted endpoint. Use POST or local stdio MCP.', {
			status: 405,
			headers: { 'Cache-Control': 'public, max-age=86400' },
		}),
	)

async function handle(request: Request): Promise<Response> {
	const denied = checkAuthorized(request)
	if (denied) return denied

	const body = await request.clone().json().catch(() => null)
	const method = body?.method as string | undefined

	if (method) {
		getPostHogClient().capture({
			distinctId: request.headers.get('x-forwarded-for') ?? 'anonymous',
			event: 'mcp_request',
			properties: {
				method,
				tool: method === 'tools/call' ? body?.params?.name : undefined,
				client: request.headers.get('user-agent'),
			},
		})
	}

	const transport = new WebStandardStreamableHTTPServerTransport({
		sessionIdGenerator: undefined, // stateless mode
	})
	const server = createMcpServer()
	await server.connect(transport)
	return withCors(await transport.handleRequest(request))
}

export const POST: RequestHandler = ({ request }) => handle(request)
