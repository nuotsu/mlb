<script lang="ts">
	import { goto } from '$app/navigation'
	import { page } from '$app/state'
	import { getToday } from '$lib/temporal'
	import { ChevronLeftIcon, ChevronRightIcon } from '$ui/icons'

	let season = $derived(Number(page.params.season ?? getToday().getFullYear()))
	let search = $derived(page.url.search)
</script>

<fieldset class="flex flex-col items-center text-center">
	<label for="season" class="block text-sm leading-rlh">Season</label>

	<div class="flex justify-center">
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

		<a class="order-first button border-b-0 border-l" href="/stats/{season - 1}{search}"><ChevronLeftIcon /></a>
		<a class="order-last border-r button border-b-0" href="/stats/{season + 1}{search}"><ChevronRightIcon /></a>
	</div>
</fieldset>

<style>
	label {
		padding-inline: 1ch;

		&:hover {
			text-decoration: underline dashed;
		}
	}
</style>
