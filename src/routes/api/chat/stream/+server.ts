import { ANTHROPIC_API_KEY } from '$env/static/private'
import { PUBLIC_POSTHOG_HOST, PUBLIC_POSTHOG_KEY } from '$env/static/public'
import { TOOLS, executeTool } from '$lib/chatbot/tools'
import { SYSTEM_PROMPT } from '$lib/chatbot/system-prompt'
import { dev } from '$app/environment'
import Anthropic from '@anthropic-ai/sdk'
import { PostHog } from 'posthog-node'
import type { RequestHandler } from './$types'

const anthropic = new Anthropic({
	apiKey: ANTHROPIC_API_KEY,
})

const posthog = new PostHog(PUBLIC_POSTHOG_KEY, {
	host: PUBLIC_POSTHOG_HOST,
})

// Simple in-memory rate limiter
const rateLimits = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(ip: string): boolean {
	const limit = 20
	const windowMs = 60 * 60 * 1000

	const now = Date.now()
	const record = rateLimits.get(ip)

	if (!record || now > record.resetAt) {
		rateLimits.set(ip, { count: 1, resetAt: now + windowMs })
		return true
	}

	if (record.count >= limit) return false
	record.count++
	return true
}

function getClientIP(request: Request): string {
	return (
		request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
		request.headers.get('x-real-ip') ||
		'unknown'
	)
}

export const POST: RequestHandler = async ({ request }) => {
	const ip = getClientIP(request)

	if (!checkRateLimit(ip)) {
		if (!dev) {
			posthog.capture({ distinctId: ip, event: 'chat_rate_limit_hit' })
		}
		return new Response(JSON.stringify({ error: 'Rate limit exceeded.' }), {
			status: 429,
			headers: { 'Content-Type': 'application/json' },
		})
	}

	const start = Date.now()
	const toolsUsed: string[] = []

	try {
		const body = await request.json()
		const { messages } = body as {
			messages: Array<{ role: 'user' | 'assistant'; content: string }>
		}

		if (!messages || !Array.isArray(messages)) {
			return new Response(JSON.stringify({ error: 'Invalid request' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' },
			})
		}

		const anthropicMessages: Anthropic.MessageParam[] = messages.map((m) => ({
			role: m.role,
			content: m.content,
		}))

		// Make initial API call before streaming to catch errors early
		let response: Anthropic.Message
		try {
			response = await anthropic.messages.create({
				model: 'claude-haiku-4-5-20251001',
				max_tokens: 1024,
				system: SYSTEM_PROMPT,
				tools: TOOLS,
				messages: anthropicMessages,
			})
		} catch (apiError) {
			console.error('Anthropic API error:', apiError)
			const err = apiError as { status?: number; error?: unknown }
			return new Response(JSON.stringify(err.error || { error: 'API error' }), {
				status: err.status || 500,
				headers: { 'Content-Type': 'application/json' },
			})
		}

		// Create a readable stream
		const stream = new ReadableStream({
			async start(controller) {
				const encoder = new TextEncoder()

				const sendEvent = (data: unknown) => {
					controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
				}

				try {
					// Handle tool use loop
					while (response.stop_reason === 'tool_use') {
						const toolUseBlocks = response.content.filter(
							(block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
						)

						const toolResults: Anthropic.ToolResultBlockParam[] = []

						for (const toolUse of toolUseBlocks) {
							toolsUsed.push(toolUse.name)
							sendEvent({ status: `Fetching ${toolUse.name}...` })

							try {
								const result = await executeTool(
									toolUse.name,
									toolUse.input as Record<string, string>,
								)
								toolResults.push({
									type: 'tool_result',
									tool_use_id: toolUse.id,
									content: JSON.stringify(result, null, 2),
								})
							} catch (error) {
								toolResults.push({
									type: 'tool_result',
									tool_use_id: toolUse.id,
									content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
									is_error: true,
								})
							}
						}

						response = await anthropic.messages.create({
							model: 'claude-haiku-4-5-20251001',
							max_tokens: 1024,
							system: SYSTEM_PROMPT,
							tools: TOOLS,
							messages: [
								...anthropicMessages,
								{ role: 'assistant', content: response.content },
								{ role: 'user', content: toolResults },
							],
						})
					}

					// Now stream the final text response
					const messagesForStream: Anthropic.MessageParam[] =
						response.stop_reason === 'end_turn'
							? // If we already have a final response from tool use, just send it
								[]
							: anthropicMessages

					if (messagesForStream.length === 0) {
						// We already have the response from tool calls, send it directly
						const textBlocks = response.content.filter(
							(block): block is Anthropic.TextBlock => block.type === 'text',
						)
						for (const block of textBlocks) {
							sendEvent({ text: block.text })
						}
					} else {
						// Stream fresh response
						const streamResponse = await anthropic.messages.stream({
							model: 'claude-haiku-4-5-20251001',
							max_tokens: 1024,
							system: SYSTEM_PROMPT,
							tools: TOOLS,
							messages: messagesForStream,
						})

						for await (const event of streamResponse) {
							if (
								event.type === 'content_block_delta' &&
								event.delta.type === 'text_delta'
							) {
								sendEvent({ text: event.delta.text })
							}
						}
					}

					// Analytics
					if (!dev) {
						posthog.capture({
							distinctId: ip,
							event: 'chat_response',
							properties: {
								tokens_in: response.usage.input_tokens,
								tokens_out: response.usage.output_tokens,
								latency_ms: Date.now() - start,
								tools_used: toolsUsed,
								model: 'claude-haiku-4-5-20251001',
								streaming: true,
							},
						})
					}

					sendEvent('[DONE]')
				} catch (error) {
					console.error('Stream error:', error)
					sendEvent({ error: 'Something went wrong.' })
				} finally {
					controller.close()
				}
			},
		})

		return new Response(stream, {
			headers: {
				'Content-Type': 'text/event-stream',
				'Cache-Control': 'no-cache',
				Connection: 'keep-alive',
			},
		})
	} catch (error) {
		console.error('Chat API error:', error)

		if (!dev) {
			posthog.capture({
				distinctId: ip,
				event: 'chat_error',
				properties: {
					error_type: error instanceof Error ? error.name : 'Unknown',
					error_message: error instanceof Error ? error.message : 'Unknown error',
				},
			})
		}

		return new Response(JSON.stringify({ error: 'Something went wrong.' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' },
		})
	}
}
