<script lang="ts">
	import { getToday } from '#lib/temporal.js'
	import { cn } from '#lib/utils.js'
	import { page } from '$app/state'
	import { CalendarTodayIcon, ChevronLeftIcon, ChevronRightIcon } from '$ui/icons'
	import type { HTMLAttributes } from 'svelte/elements'

	let {
		class: className,
		buttons = true,
		onPrev,
		onNext,
		onchange,
		...props
	}: {
		name?: string
		class?: string
		buttons?: boolean
		onPrev?: () => void
		onNext?: () => void
		onchange?: HTMLAttributes<HTMLSelectElement>['onchange']
	} & Omit<HTMLAttributes<HTMLSelectElement>, 'onchange'> = $props()

	let select = $state<HTMLSelectElement | null>(null)
	let season = $state(Number(page.params.season ?? getToday().getFullYear()))

	$effect(() => {
		season = Number(page.params.season ?? getToday().getFullYear())
	})
</script>

<fieldset class="flex justify-center gap-px text-center {className}">
	{#if buttons}
		<button
			type="button"
			class="button"
			onclick={() => {
				if (!select) return
				season = getToday().getFullYear()
				select.value = season.toString()
				onchange?.({ currentTarget: select } as Event & {
					currentTarget: HTMLSelectElement & EventTarget
				})
			}}
		>
			<CalendarTodayIcon value={getToday().getFullYear() % 100} />
		</button>
	{/if}

	<select
		class="button text-center"
		id="season"
		bind:value={season}
		bind:this={select}
		{onchange}
		{...props}
	>
		{#each { length: getToday().getFullYear() - 1876 + 1 } as _, i}
			{@const year = getToday().getFullYear() - i}
			<option value={year}>{year}</option>
		{/each}
	</select>

	{#if buttons}
		<button
			type="button"
			class="border-p order-first button border-b-0 border-l"
			onclick={() => {
				if (!select) return
				season--
				select.value = season.toString()
				onchange?.({ currentTarget: select } as Event & {
					currentTarget: HTMLSelectElement & EventTarget
				})
			}}
		>
			<ChevronLeftIcon />
		</button>
		<button
			type="button"
			class={cn(
				'order-last button border-r border-b-0',
				season + 1 > getToday().getFullYear() && 'pointer-events-none opacity-50',
			)}
			onclick={() => {
				if (!select) return
				season++
				select.value = season.toString()
				onchange?.({ currentTarget: select } as Event & {
					currentTarget: HTMLSelectElement & EventTarget
				})
			}}
		>
			<ChevronRightIcon />
		</button>
	{/if}
</fieldset>
