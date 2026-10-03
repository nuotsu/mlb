<script lang="ts">
	import { getToday } from '#lib/temporal.js'
	import { cn } from '#lib/utils.js'
	import { CalendarTodayIcon, ChevronLeftIcon, ChevronRightIcon } from '#ui/icons/index.js'
	import type { HTMLAttributes, HTMLInputAttributes } from 'svelte/elements'

	let {
		buttons = true,
		value = $bindable(getToday().toISOString().split('T')[0]),
		min = '1876-01',
		onchange,
		...props
	}: {
		buttons?: boolean
		value?: string
		onchange?: HTMLAttributes<HTMLInputElement>['onchange']
	} & HTMLInputAttributes = $props()

	const MONTHS = [
		'January',
		'February',
		'March',
		'April',
		'May',
		'June',
		'July',
		'August',
		'September',
		'October',
		'November',
		'December',
	]

	const today = getToday()
	const todayYear = today.getFullYear()
	const minYear = $derived(Number(min?.toString().split('-')[0]))

	function toValue(y: number, m: number) {
		return `${y}-${String(m).padStart(2, '0')}`
	}

	let year = $derived(Number(value.split('-')[0]))
	let month = $derived(Number(value.split('-')[1]))

	let input = $state<HTMLInputElement | null>(null)

	function fireChange() {
		if (!input) return
		onchange?.({ currentTarget: input } as Event & {
			currentTarget: HTMLInputElement & EventTarget
		})
	}

	function prev() {
		if (month > 1) value = toValue(year, month - 1)
		else if (year > minYear) value = toValue(year - 1, 12)
		fireChange()
	}

	function next() {
		if (month < 12) value = toValue(year, month + 1)
		else if (year < todayYear + 1) value = toValue(year + 1, 1)
		fireChange()
	}
</script>

<fieldset class="flex justify-center gap-px text-center">
	<button
		type="button"
		class="button"
		onclick={() => {
			value = toValue(todayYear, getToday().getMonth() + 1)
			fireChange()
		}}
	>
		<CalendarTodayIcon value={getToday().getMonth() + 1} />
	</button>

	<label class="button grow">
		{MONTHS[month - 1]}
		{year}
		<input
			class="sr-only"
			type="month"
			{min}
			max={toValue(todayYear + 1, 12)}
			bind:value
			bind:this={input}
			onclick={(e) => (e.target as HTMLInputElement)?.showPicker()}
			{onchange}
			{...props}
		/>
	</label>

	{#if buttons}
		<button
			type="button"
			class={cn(
				'order-first button border-b-0 border-l',
				month <= 1 && year <= minYear && 'pointer-events-none opacity-50',
			)}
			onclick={prev}
		>
			<ChevronLeftIcon />
		</button>

		<button
			type="button"
			class={cn(
				'order-last button border-r border-b-0',
				month >= 12 && year >= todayYear + 1 && 'pointer-events-none opacity-50',
			)}
			onclick={next}
		>
			<ChevronRightIcon />
		</button>
	{/if}
</fieldset>
