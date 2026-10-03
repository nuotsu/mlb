<script lang="ts">
	import { formatDate, getToday, slash } from '#lib/temporal.js'
	import { maintainSearchParams } from '#lib/url.svelte.js'
	import { CalendarTodayIcon, ChevronLeftIcon, ChevronRightIcon } from '$ui/icons'

	let {
		date,
		onchange,
		class: className,
	}: {
		date: string
		onchange?: (date: string) => void
		class?: string
	} = $props()

	const today = getToday()
	const todayStr = formatDate(today, { locale: 'en-CA' })

	function addDay(days: number = 1) {
		return formatDate(
			new Date(new Date(slash(date)).setDate(new Date(slash(date)).getDate() + days)),
			{ locale: 'en-CA' },
		)
	}
</script>

<fieldset class="flex flex-col items-center text-center {className}">
	<div class="flex justify-center gap-px">
		<a class="button" href={maintainSearchParams(`/schedule/day/${todayStr}`)}>
			<CalendarTodayIcon value={today.getDate()} />
		</a>

		<label class="button min-w-[16ch]">
			{formatDate(slash(date), {
				month: 'short',
				weekday: 'short',
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
				onchange={(e) => onchange?.(e.currentTarget.value)}
			/>
		</label>

		<a
			class="order-first button border-b-0 border-l"
			href={maintainSearchParams(`/schedule/day/${addDay(-1)}`)}
		>
			<ChevronLeftIcon />
		</a>
		<a
			class="order-last button border-r border-b-0"
			href={maintainSearchParams(`/schedule/day/${addDay()}`)}
		>
			<ChevronRightIcon />
		</a>
	</div>
</fieldset>
