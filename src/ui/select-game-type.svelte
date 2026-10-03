<script lang="ts">
	import { goto } from '$app/navigation'
	import { page } from '$app/state'

	let {
		class: className,
		options = [],
		available,
	}: {
		class?: string
		options?: { value: string; label: string }[]
		available?: string[]
	} = $props()

	const GAME_TYPES = $derived([
		{ value: 'S', label: 'Spring Training' },
		{ value: 'R', label: 'Regular Season' },
		{ value: 'P', label: 'Postseason' },
		...options,
	])

	let gameType = $derived(page.url.searchParams.get('gameType') ?? 'R')
</script>

<select
	class={className}
	value={gameType}
	onchange={(e) => {
		const url = new URL(page.url.href)
		const value = (e.target as HTMLSelectElement).value

		if (value !== 'R') {
			url.searchParams.set('gameType', value)
		} else {
			url.searchParams.delete('gameType')
		}

		goto(url.toString())
	}}
>
	{#each GAME_TYPES as { value, label } (value)}
		<option {value} selected={value === gameType} disabled={available && !available.includes(value)}
			>{label}</option
		>
	{/each}
</select>
