<script lang="ts">
	import { formatDate, formatWeekRange, getToday, slash } from '$lib/temporal'
	import { ChevronLeftIcon, ChevronRightIcon } from '$ui/icons'

	let {
		date,
		onDateChange,
	}: {
		date: string
		onDateChange?: (date: string) => void
	} = $props()

	function addWeek(weeks: number = 1) {
		return formatDate(
			new Date(new Date(slash(date)).setDate(new Date(slash(date)).getDate() + weeks * 7)),
			{ locale: 'en-CA' },
		)
	}
</script>

<fieldset class="flex justify-center">
	<label class="min-w-[14ch] grow text-center">
		{formatWeekRange(date)}

		<input
			id="week"
			class="sr-only"
			type="date"
			min="1901-01-01"
			max={`${getToday().getFullYear()}-12-31`}
			value={date}
			onclick={(e) => (e.target as HTMLInputElement)?.showPicker()}
			onchange={(e) => onDateChange?.(e.currentTarget.value)}
		/>
	</label>

	<a class="order-first button border-b-0 border-l" href="/schedule/week/{addWeek(-1)}">
		<ChevronLeftIcon />
	</a>
	<a class="order-last button border-r border-b-0" href="/schedule/week/{addWeek()}">
		<ChevronRightIcon />
	</a>
</fieldset>

<style>
	fieldset:has(label:hover) label {
		padding-inline: 1ch;
		text-decoration: underline dashed;
	}
</style>
