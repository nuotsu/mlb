<script lang="ts">
	import Loading from '$ui/loading.svelte'
	import type { BundledLanguage } from 'shiki'
	import { addButtonHandlers, shiki } from './utils'

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

	let post = $state(false)

	$effect(() => {
		if (post) {
			addButtonHandlers()
		}
	})
</script>

{#await shiki({ code, lang, pre, className })}
	<Loading class="loading-results p-ch" />
{:then html}
	{@html html}

	<div hidden>{(post = true)}</div>
{/await}
