<script lang="ts">
	import { goto } from '$app/navigation'
	import { page } from '$app/state'
	import { formatDate, getToday, slash } from '$lib/temporal'
	import { debounce } from '$lib/utils'
	import { getWeekDates } from './store.svelte'

	let date = $derived(page.params.date)

	const { startDate, endDate } = $derived(getWeekDates(page.params.date!))
	const isSameMonth = $derived(startDate.getMonth() === endDate.getMonth())

	function addWeek(weeks: number = 1) {
		return formatDate(
			new Date(
				new Date(slash(page.params.date)).setDate(
					new Date(slash(page.params.date)).getDate() + weeks * 7,
				),
			),
			{ locale: 'en-CA' },
		)
	}
</script>

<fieldset class="flex flex-col items-center">
	<label for="week" class="block text-sm leading-rlh">Weekly Schedule</label>

	<div class="flex justify-center">
		<label class="min-w-[16ch] text-center">
			{formatDate(startDate, { month: isSameMonth ? 'long' : 'short', day: 'numeric' })}
			-
			{formatDate(endDate, isSameMonth ? { day: 'numeric' } : { month: 'short', day: 'numeric' })}

			<input
				id="week"
				class="sr-only"
				type="date"
				min="1901-01-01"
				max={`${getToday().getFullYear()}-12-31`}
				value={date}
				onclick={(e) => (e.target as HTMLInputElement)?.showPicker()}
				onchange={debounce((e) => goto(`/schedule/week/${e.currentTarget.value}`), 3000)}
				onblur={(e) => goto(`/schedule/week/${e.currentTarget.value}`)}
			/>
		</label>

		<a class="order-first" href="/schedule/week/{addWeek(-1)}">{'<'}</a>
		<a class="order-last" href="/schedule/week/{addWeek()}">{'>'}</a>
	</div>
</fieldset>

<style>
	fieldset:has(label:hover) label,
	a {
		padding-inline: 1ch;
	}

	fieldset:has(label:hover) label,
	a:hover {
		text-decoration: underline dashed;
	}
</style>
