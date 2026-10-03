<script lang="ts">
	import { formatDate, formatWeekRange, getToday, slash } from '#lib/temporal.js'
	import { maintainSearchParams } from '#lib/url.svelte.js'
	import { CalendarTodayIcon, ChevronLeftIcon, ChevronRightIcon } from '$ui/icons'

	let {
		date,
		onchange,
		href = '/schedule/week',
		class: className,
	}: {
		date: string
		onchange?: (date: string) => void
		href?: string
		class?: string
	} = $props()

	const today = getToday()
	const todayStr = formatDate(today, { locale: 'en-CA' })

	function addWeek(weeks: number = 1) {
		return formatDate(
			new Date(new Date(slash(date)).setDate(new Date(slash(date)).getDate() + weeks * 7)),
			{ locale: 'en-CA' },
		)
	}
</script>

<fieldset class="flex justify-center gap-px {className}">
	<a class="button" href={maintainSearchParams(`${href}/${todayStr}`)}>
		<CalendarTodayIcon value={today.getDate()} />
	</a>

	<label class="button min-w-[14ch] grow">
		{formatWeekRange(date)}

		<input
			id="week"
			class="sr-only"
			type="date"
			min="1901-01-01"
			max={`${getToday().getFullYear()}-12-31`}
			value={date}
			onclick={(e) => (e.target as HTMLInputElement)?.showPicker()}
			onchange={(e) => onchange?.(e.currentTarget.value)}
		/>
	</label>

	<a
		class="order-first button border-b-0 border-l"
		href={maintainSearchParams(`${href}/${addWeek(-1)}`)}
	>
		<ChevronLeftIcon />
	</a>

	<a
		class="order-last button border-r border-b-0"
		href={maintainSearchParams(`${href}/${addWeek()}`)}
	>
		<ChevronRightIcon />
	</a>
</fieldset>
