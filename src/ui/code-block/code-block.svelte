<script lang="ts">
	import { page } from '$app/state'
	import { count } from '$lib/utils'
	import Loading from '$ui/loading.svelte'
	import type { BundledLanguage } from 'shiki'
	import shiki from './shiki'

	let {
		code,
		lang,
		pre,
		className,
	}: {
		code: string
		lang: BundledLanguage
		pre?: string
		className?: string
	} = $props()

	let MAX_LINES = 500
	let lines = $derived(code.split('\n'))
	let truncated = $derived(
		lines.length > MAX_LINES ? page.form?.truncated : lines.length > MAX_LINES,
	)
	let codeToRender = $derived(truncated ? lines.slice(0, MAX_LINES).join('\n') : code)
</script>

{#await shiki({ code: codeToRender, lang, pre, className })}
	<Loading class="loading-results p-ch" />
{:then html}
	{@html html}

	{#if truncated}
		<menu class="sticky bottom-0 p-ch text-sm">
			<li>
				<button
					class="action-tertiary bg-background/50 backdrop-blur-xs"
					onclick={() => (truncated = false)}
				>
					Show {count(lines.length - MAX_LINES, 'more line', 'more lines')}
				</button>
			</li>
		</menu>
	{/if}
{/await}

<style>
	menu {
		padding-bottom: max(1ch, env(safe-area-inset-bottom));
	}
</style>
