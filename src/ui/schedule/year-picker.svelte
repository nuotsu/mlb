<script lang="ts">
	import { goto } from '$app/navigation'
	import { page } from '$app/state'
	import { getToday } from '$lib/temporal'
	import { ChevronLeftIcon, ChevronRightIcon } from '$ui/icons'

	let year = $derived(Number(page.params.season ?? getToday().getFullYear()))

	function addYear(years: number = 1) {
		return year + years
	}
</script>

<fieldset class="flex flex-col items-center text-center">
	<label for="year" class="block text-sm leading-rlh">Season</label>

	<div class="flex justify-center">
		<label class="min-w-[8ch]">
			<input
				class="min-w-[6ch] appearance-none text-center decoration-dashed hover:underline"
				id="year"
				type="number"
				min="1876"
				max={getToday().getFullYear()}
				value={year}
				onchange={(e) => goto(`/standings/${e.currentTarget.value}`)}
			/>
		</label>

		<a class="order-first button border-b-0 border-l" href="/standings/{addYear(-1)}"><ChevronLeftIcon /></a>
		<a class="order-last border-r button border-b-0" href="/standings/{addYear()}"><ChevronRightIcon /></a>
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
