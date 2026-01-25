<script lang="ts">
	import ChatInput from '$ui/chat/input.svelte'
	import Loading from '$ui/icons/loading.svelte'
	import Metadata from '$ui/metadata.svelte'
	import { marked } from 'marked'

	marked.use({
		breaks: true,
		renderer: {
			link: ({ href, text }) => `<a href="${href}" class="link">${text}</a>`,
		},
	})

	type Message = { role: 'user' | 'assistant'; content: string; isError?: boolean }

	const MAX_LENGTH = 250

	let messages = $state<Message[]>([])
	let input = $state('')
	let loading = $state(false)
	let streamingContent = $state('')
	let error = $state<string | null>(null)
	let abortController: AbortController | null = null
	let bottomHeight = $state(0)
	let rateLimitRemaining = $state<number | null>(null)

	// Countdown timer for rate limit
	function startRateLimitTimer(seconds: number) {
		rateLimitRemaining = seconds

		const interval = setInterval(() => {
			if (rateLimitRemaining && rateLimitRemaining > 0) {
				rateLimitRemaining--
			} else {
				rateLimitRemaining = null
				clearInterval(interval)
			}
		}, 1000)
	}

	// Auto-scroll attachment that scrolls to bottom when content changes
	function autoscroll(container: HTMLElement) {
		$effect(() => {
			// Track these values to trigger the effect
			messages.length
			streamingContent

			container.scrollTo({
				top: container.scrollHeight,
				behavior: 'smooth',
			})
		})
	}

	function parseError(data: unknown): { message: string; isRateLimit: boolean } {
		if (typeof data === 'object' && data !== null) {
			const err = data as { error?: { type?: string; message?: string } | string }
			if (err.error && typeof err.error === 'object') {
				const { type, message } = err.error
				if (type === 'rate_limit_error') {
					return { message: 'Rate limit exceeded.', isRateLimit: true }
				}
				return { message: message || 'An error occurred.', isRateLimit: false }
			}
			if (typeof err.error === 'string') {
				return { message: err.error, isRateLimit: false }
			}
		}
		return { message: 'Something went wrong.', isRateLimit: false }
	}

	async function send() {
		if (!input.trim() || loading) return

		const userMessage = input.trim()
		messages.push({ role: 'user', content: userMessage })
		input = ''
		loading = true
		streamingContent = ''
		error = null
		abortController = new AbortController()

		try {
			const response = await fetch('/api/chat/stream', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ messages }),
				signal: abortController.signal,
			})

			if (!response.ok) {
				const data = await response.json()
				const parsed = parseError(data)
				error = parsed.message

				if (parsed.isRateLimit) {
					// Start 60 second countdown (adjust based on API response if available)
					startRateLimitTimer(60)
				} else {
					messages.push({ role: 'assistant', content: parsed.message, isError: true })
				}
				return
			}

			const reader = response.body?.getReader()
			const decoder = new TextDecoder()

			if (!reader) {
				messages.push({ role: 'assistant', content: 'No response body.' })
				return
			}

			while (true) {
				const { done, value } = await reader.read()
				if (done) break

				const chunk = decoder.decode(value)
				const lines = chunk.split('\n')

				for (const line of lines) {
					if (line.startsWith('data: ')) {
						const data = line.slice(6)
						if (data === '[DONE]') continue

						try {
							const parsed = JSON.parse(data)
							if (parsed.clear) {
								streamingContent = ''
							}
							if (parsed.text) {
								streamingContent += parsed.text
							}
						} catch {
							// ignore parse errors
						}
					}
				}
			}

			messages.push({ role: 'assistant', content: streamingContent })
			streamingContent = ''
		} catch (e) {
			if ((e as Error).name !== 'AbortError') {
				messages.push({ role: 'assistant', content: 'Something went wrong.' })
			}
		} finally {
			loading = false
		}
	}

	function stop() {
		abortController?.abort()
		if (streamingContent) {
			messages.push({ role: 'assistant', content: streamingContent + ' [stopped]' })
			streamingContent = ''
		}
		loading = false
	}

	function parseMarkdown(text: string): string {
		return marked.parse(text, { async: false }) as string
	}
</script>

<Metadata title="Ask Mitch" description="Ask Mitch about anything MLB" />

<section
	class="mx-auto flex h-dvh max-w-3xl flex-col space-y-lh overflow-y-auto px-ch py-ch"
	style:scroll-padding-bottom="{bottomHeight}px"
	{@attach autoscroll}
>
	{#each messages as message, i (i)}
		<div class="message {message.role}" class:error={message.isError}>
			<strong>{message.role === 'assistant' ? 'Mitch' : 'You'}:</strong>
			<div class="content">{@html parseMarkdown(message.content)}</div>
		</div>
	{/each}

	{#if loading && !streamingContent}
		<div class="message assistant loading">
			<Loading class="animate-spin">Thinking...</Loading>
		</div>
	{/if}

	{#if streamingContent}
		<div class="message assistant">
			<strong>Mitch:</strong>
			<div class="content">{@html parseMarkdown(streamingContent)}</div>
		</div>
	{/if}

	<div class="sticky bottom-0 mt-auto backdrop-blur" bind:offsetHeight={bottomHeight}>
		{#if rateLimitRemaining}
			<small class="block p-ch text-center text-red-500">
				Rate limit exceeded. Try again in {rateLimitRemaining}s
			</small>
		{/if}

		<ChatInput
			bind:value={input}
			{loading}
			disabled={!!rateLimitRemaining}
			maxlength={MAX_LENGTH}
			placeholder="Ask about MLB stats..."
			onsend={send}
			onstop={stop}
		/>
	</div>
</section>
