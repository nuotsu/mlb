<script lang="ts">
	import Loading from '$ui/icons/loading.svelte'
	import type { HTMLTextareaAttributes } from 'svelte/elements'

	let {
		value = $bindable(''),
		loading = false,
		disabled = false,
		maxlength = 250,
		placeholder = '',
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

<div class="chat-input flex">
	<div class="relative grow">
		<textarea
			class="input field-sizing-content w-full p-ch"
			bind:value
			onkeydown={handleKeydown}
			rows={2}
			{maxlength}
			{placeholder}
			disabled={disabled || loading}
		></textarea>
		<small
			class="pointer-events-none absolute right-2 bottom-2 text-xs opacity-50"
			class:text-red-500={charCount >= maxlength!}
			class:opacity-100={charCount >= maxlength! * 0.8}
		>
			{charCount}/{maxlength}
		</small>
	</div>

	{#if loading}
		<button class="action shrink-0" onclick={onstop}>
			<Loading class="animate-spin" />
			Stop
		</button>
	{:else}
		<button class="action shrink-0" onclick={onsend} disabled={!(value as string).trim()}
			>Send</button
		>
	{/if}
</div>
