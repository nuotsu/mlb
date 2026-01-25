<script lang="ts">
	import { ArrowUpIcon, StopIcon } from '$ui/icons'
	import type { HTMLTextareaAttributes } from 'svelte/elements'

	const MAX_LENGTH = 250

	let {
		value = $bindable(''),
		loading = false,
		disabled = false,
		onsend,
		onstop,
	}: {
		loading?: boolean
		onsend?: () => void
		onstop?: () => void
	} & HTMLTextareaAttributes = $props()

	let charCount = $derived((value as string).length)

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault()
			onsend?.()
		}
	}
</script>

<div class="flex">
	<div class="relative grow">
		<textarea
			class="input field-sizing-content w-full p-ch"
			bind:value
			onkeydown={handleKeydown}
			rows={2}
			maxlength={MAX_LENGTH}
			placeholder="Ask me anything about MLB..."
			disabled={disabled || loading}
		></textarea>

		<small
			class="pointer-events-none absolute right-2 bottom-2 text-xs text-current/25"
			class:text-red-500={charCount >= MAX_LENGTH}
			class:opacity-100={charCount >= MAX_LENGTH * 0.8}
		>
			{charCount}/{MAX_LENGTH}
		</small>
	</div>

	{#if loading}
		<button class="action shrink-0" onclick={onstop} aria-label="Stop">
			<StopIcon />
		</button>
	{:else}
		<button
			class="action shrink-0"
			onclick={onsend}
			disabled={!(value as string).trim()}
			aria-label="Send"
		>
			<ArrowUpIcon />
		</button>
	{/if}
</div>

<style>
	textarea {
		min-height: 2lh;
		max-height: 6lh;
		background-color: transparent;
	}

	button :global(svg) {
		width: 1lh;
		height: 1lh;
	}
</style>
