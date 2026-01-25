import Anthropic from '@anthropic-ai/sdk'
import { json } from '@sveltejs/kit'
import { dev } from '$app/environment'
import { ANTHROPIC_API_KEY } from '$env/static/private'
import { PUBLIC_POSTHOG_HOST, PUBLIC_POSTHOG_KEY } from '$env/static/public'
import { SYSTEM_PROMPT } from '$lib/chat/system-prompt'
import { CLAUDE_MODEL, executeTool, TOOLS } from '$lib/chat/tools'
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
	const limit = 20 // queries per window
	const windowMs = 60 * 60 * 1000 // 1 hour

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

	// Rate limiting
	if (!checkRateLimit(ip)) {
		if (!dev) {
			posthog.capture({
				distinctId: ip,
				event: 'chat_rate_limit_hit',
			})
		}
		return json({ error: 'Rate limit exceeded. Try again later.' }, { status: 429 })
	}

	const start = Date.now()
	let toolsUsed: string[] = []

	try {
		const body = await request.json()
		const { messages } = body as {
			messages: Array<{ role: 'user' | 'assistant'; content: string }>
		}

		if (!messages || !Array.isArray(messages)) {
			return json({ error: 'Invalid request: messages required' }, { status: 400 })
		}

		// Convert to Anthropic message format
		const anthropicMessages: Anthropic.MessageParam[] = messages.map((m) => ({
			role: m.role,
			content: m.content,
		}))

		// Initial API call with tools
		let response = await anthropic.messages.create({
			model: CLAUDE_MODEL,
			max_tokens: 1024,
			system: SYSTEM_PROMPT,
			tools: TOOLS,
			messages: anthropicMessages,
		})

		// Handle tool use loop
		while (response.stop_reason === 'tool_use') {
			const toolUseBlocks = response.content.filter(
				(block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
			)

			const toolResults: Anthropic.ToolResultBlockParam[] = []

			for (const toolUse of toolUseBlocks) {
				toolsUsed.push(toolUse.name)

				try {
					const result = await executeTool(toolUse.name, toolUse.input as Record<string, string>)
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

			// Continue conversation with tool results
			response = await anthropic.messages.create({
				model: CLAUDE_MODEL,
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

		// Extract text response
		const textBlocks = response.content.filter(
			(block): block is Anthropic.TextBlock => block.type === 'text',
		)
		const content = textBlocks.map((b) => b.text).join('\n')

		// Track analytics
		if (!dev) {
			posthog.capture({
				distinctId: ip,
				event: 'chat_response',
				properties: {
					tokens_in: response.usage.input_tokens,
					tokens_out: response.usage.output_tokens,
					latency_ms: Date.now() - start,
					tools_used: toolsUsed,
					model: CLAUDE_MODEL,
				},
			})
		}

		return json({
			content,
			usage: {
				input_tokens: response.usage.input_tokens,
				output_tokens: response.usage.output_tokens,
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

		return json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
	}
}
