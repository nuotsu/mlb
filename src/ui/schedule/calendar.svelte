<script lang="ts">
	import { formatDate, getToday } from '#lib/temporal.js'
	import { cn } from '#lib/utils.js'
	import type { Snippet } from 'svelte'
	import type { HTMLAttributes, HTMLInputAttributes } from 'svelte/elements'
	import SelectMonthWithYear from './select-month-with-year.svelte'

	let {
		class: className,
		buttons = true,
		onchange,
		inputProps,
		cells,
	}: {
		class?: string
		buttons?: boolean
		onchange?: HTMLAttributes<HTMLInputElement>['onchange']
		inputProps?: HTMLInputAttributes
		cells?: Snippet<[{ day: number | null; year: number; month: number }]>
	} & Omit<HTMLAttributes<HTMLInputElement>, 'onchange'> = $props()

	const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

	const today = getToday()
	const todayYear = today.getFullYear()
	const todayMonth = today.getMonth() + 1

	let selected = $state(`${todayYear}-${String(todayMonth).padStart(2, '0')}`)
	let year = $derived(Number(selected.split('-')[0]))
	let month = $derived(Number(selected.split('-')[1]))

	let weeks = $derived.by(() => {
		const firstDay = new Date(year, month - 1, 1)
		const daysInMonth = new Date(year, month, 0).getDate()
		const startOffset = (firstDay.getDay() + 6) % 7
		const cells: (number | null)[] = [
			...Array(startOffset).fill(null),
			...Array.from({ length: daysInMonth }, (_, i) => i + 1),
		]
		while (cells.length % 7 !== 0) cells.push(null)
		return Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7))
	})
</script>

<div class={className}>
	<SelectMonthWithYear bind:value={selected} {buttons} {onchange} {...inputProps} />

	<table class="w-full table-fixed text-center">
		<thead class="text-sm">
			<tr>
				{#each DOW as d (d)}
					<th class="border border-transparent font-normal text-current/40">{d}</th>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each weeks as week, wi (wi)}
				<tr>
					{#each week as day, di (di)}
						{@const date = `${year}-${String(month).padStart(2, '0')}-${day?.toString().padStart(2, '0')}`}
						{@const isToday = formatDate(getToday(), { locale: 'en-CA' }) === date}

						<td
							class={cn(
								'border border-b-2 border-transparent align-top',
								!day && 'opacity-0',
								isToday ? 'bg-accent text-dark' : 'hover:bg-accent/10 hover:text-accent',
							)}
						>
							{#if day}
								<a
									class={cn('block ', cells && !isToday && 'not-has-[+*]:text-current/40')}
									href="/schedule/day/{date}"
								>
									{day}
								</a>
							{/if}

							{@render cells?.({ day, year, month })}
						</td>
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>
</div>
