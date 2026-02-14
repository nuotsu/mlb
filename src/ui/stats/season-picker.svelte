<script lang="ts">
	import { goto } from '$app/navigation'
	import { page } from '$app/state'
	import { getToday } from '$lib/temporal'
	import { cn } from '$lib/utils'
	import { ChevronLeftIcon, ChevronRightIcon } from '$ui/icons'

	let {
		class: className,
	}: {
		class?: string
	} = $props()

	let season = $derived(Number(page.params.season ?? getToday().getFullYear()))
	let search = $derived(page.url.search)
</script>

<fieldset class="flex justify-center text-center {className}">
	<label class="min-w-[8ch]">
		<input
			class="min-w-[6ch] appearance-none text-center decoration-dashed hover:underline"
			id="season"
			type="number"
			min="1876"
			max={getToday().getFullYear()}
			value={season}
			onchange={(e) => goto(`/stats/${e.currentTarget.value}${search}`)}
		/>
	</label>

	<a class="order-first button border-b-0 border-l" href="/stats/{season - 1}{search}">
		<ChevronLeftIcon />
	</a>

	<a
		class={cn(
			'order-last button border-r border-b-0',
			season + 1 > getToday().getFullYear() && 'pointer-events-none opacity-50',
		)}
		href="/stats/{season + 1}{search}"
	>
		<ChevronRightIcon />
	</a>
</fieldset>

<style>
	label {
		padding-inline: 1ch;

		&:hover {
			text-decoration: underline dashed;
		}
	}
</style>
