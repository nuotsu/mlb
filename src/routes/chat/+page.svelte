<script lang="ts">
	import Loading from '$ui/icons/loading.svelte'
	import Metadata from '$ui/metadata.svelte'

	type Message = { role: 'user' | 'assistant'; content: string; isError?: boolean }

	let messages = $state<Message[]>([])
	let input = $state('')
	let loading = $state(false)
	let streamingContent = $state('')
	let error = $state<string | null>(null)
	let abortController: AbortController | null = null

	function parseError(data: unknown): string {
		if (typeof data === 'object' && data !== null) {
			const err = data as { error?: { type?: string; message?: string } | string }
			if (err.error && typeof err.error === 'object') {
				const { type, message } = err.error
				if (type === 'rate_limit_error') {
					return 'Rate limit exceeded. Please wait a moment and try again.'
				}
				return message || 'An error occurred.'
			}
			if (typeof err.error === 'string') {
				return err.error
			}
		}
		return 'Something went wrong.'
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
				const errorMessage = parseError(data)
				error = errorMessage
				messages.push({ role: 'assistant', content: errorMessage, isError: true })
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

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault()
			send()
		}
	}
</script>

<Metadata title="Ask Mitch" description="Ask Mitch about anything MLB" />

<section class="flex min-h-dvh flex-col">
	<div class="messages px-ch py-ch">
		{#each messages as message, i (i)}
			<div class="message {message.role}" class:error={message.isError}>
				<strong>{message.role}:</strong>
				<pre style="field-sizing: content; white-space: pre-wrap;">{message.content}</pre>
			</div>
		{/each}

		{#if loading && !streamingContent}
			<div class="message assistant loading">
				<Loading class="animate-spin">Thinking...</Loading>
			</div>
		{/if}

		{#if streamingContent}
			<div class="message assistant">
				<strong>assistant:</strong>
				<pre style="field-sizing: content; white-space: pre-wrap;">{streamingContent}</pre>
			</div>
		{/if}
	</div>

	<div class="sticky bottom-0 mt-auto flex p-ch backdrop-blur">
		<textarea
			class="input field-sizing-content min-h-[3lh] grow"
			bind:value={input}
			onkeydown={handleKeydown}
			placeholder="Ask about MLB stats... (Enter to send, Shift+Enter for newline)"
			disabled={loading}
		></textarea>

		{#if loading}
			<button class="action shrink-0" onclick={stop}>
				<Loading class="animate-spin" />
				Stop
			</button>
		{:else}
			<button class="action shrink-0" onclick={send} disabled={!input.trim()}>Send</button>
		{/if}
	</div>
</section>
