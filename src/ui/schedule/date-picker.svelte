<script lang="ts">
	import { formatDate, getToday, slash } from '$lib/temporal'
	import { ChevronLeftIcon, ChevronRightIcon } from '$ui/icons'

	let {
		date,
		onDateChange,
	}: {
		date: string
		onDateChange?: (date: string) => void
	} = $props()

	function addDay(days: number = 1) {
		return formatDate(
			new Date(new Date(slash(date)).setDate(new Date(slash(date)).getDate() + days)),
			{ locale: 'en-CA' },
		)
	}
</script>

<fieldset class="flex flex-col items-center text-center">
	<a href="/schedule/week/{date}" class="block text-sm leading-rlh">
		{formatDate(slash(date), { weekday: 'long' })}
	</a>

	<div class="flex justify-center">
		<label class="min-w-[16ch]">
			{formatDate(slash(date), {
				month: 'long',
				day: 'numeric',
				year: 'numeric',
			})}

			<input
				id="date"
				class="sr-only"
				type="date"
				min="1901-01-01"
				max={`${getToday().getFullYear()}-12-31`}
				value={date}
				onclick={(e) => (e.target as HTMLInputElement)?.showPicker()}
				onchange={(e) => onDateChange?.(e.currentTarget.value)}
			/>
		</label>

		<a class="order-first button border-b-0 border-l" href="/schedule/day/{addDay(-1)}"><ChevronLeftIcon /></a>
		<a class="order-last border-r button border-b-0" href="/schedule/day/{addDay()}"><ChevronRightIcon /></a>
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
