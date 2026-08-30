<script lang="ts">
	import { monthName } from '$lib/temporal'
	import { cn } from '$lib/utils'
	import { ChevronLeftIcon, ChevronRightIcon } from '$ui/icons'
	import type { HTMLAttributes } from 'svelte/elements'

	let {
		class: className,
		buttons = true,
		value = '',
		min = 1,
		max = 12,
		allLabel,
		onchange,
		...props
	}: {
		name?: string
		class?: string
		buttons?: boolean
		/** 1-12, or `''` when no single month is picked */
		value?: number | ''
		min?: number
		/** Months past this one are disabled — they haven't been played yet */
		max?: number
		/** Adds a leading option, valued `''`, for the whole season */
		allLabel?: string
		onchange?: HTMLAttributes<HTMLSelectElement>['onchange']
	} & Omit<HTMLAttributes<HTMLSelectElement>, 'onchange' | 'value'> = $props()

	const MONTHS = Array.from({ length: 12 }, (_, i) => monthName(i + 1))

	let select = $state<HTMLSelectElement | null>(null)
	let month = $derived(value === '' ? '' : String(value))

	function step(to: number) {
		if (!select) return
		select.value = to.toString()
		onchange?.({ currentTarget: select } as Event & {
			currentTarget: HTMLSelectElement & EventTarget
		})
	}
</script>

<fieldset class="flex justify-center gap-px text-center {className}">
	<select
		class="button text-center"
		id="month"
		value={month}
		bind:this={select}
		{onchange}
		{...props}
	>
		{#if allLabel}
			<option value="" selected={month === ''}>{allLabel}</option>
		{/if}

		{#each MONTHS as name, i (name)}
			<option
				value={String(i + 1)}
				selected={month === String(i + 1)}
				disabled={i + 1 < min || i + 1 > max}
			>
				{name}
			</option>
		{/each}
	</select>

	{#if buttons}
		<button
			type="button"
			class={cn(
				'order-first button border-b-0 border-l',
				(month === '' || Number(month) <= min) && 'pointer-events-none opacity-50',
			)}
			aria-label="Previous month"
			onclick={() => step(Number(month) - 1)}
		>
			<ChevronLeftIcon />
		</button>

		<button
			type="button"
			class={cn(
				'order-last button border-r border-b-0',
				(month === '' || Number(month) >= max) && 'pointer-events-none opacity-50',
			)}
			aria-label="Next month"
			onclick={() => step(Number(month) + 1)}
		>
			<ChevronRightIcon />
		</button>
	{/if}
</fieldset>
