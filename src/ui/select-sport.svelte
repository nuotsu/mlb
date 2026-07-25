<script lang="ts">
	import { browser } from '$app/environment'
	import { goto } from '$app/navigation'
	import { page } from '$app/state'
	import { fetchMLB } from '$lib/fetch'
	import { BallIcon } from './icons'

	let {
		class: className,
		available,
	}: {
		class?: string
		available?: number[]
	} = $props()

	let sport = $derived(page.url.searchParams.get('sportId') ?? '1')
	let sports = $state<MLB.Sport[] | undefined>()

	$effect(() => {
		if (!browser) return

		let cancelled = false
		fetchMLB<MLB.SportsResponse>('/api/v1/sports', {
			fields: ['sports,id,name,abbreviation'],
		})
			.then((data) => {
				if (!cancelled) sports = data.sports
			})
			.catch(() => {
				if (!cancelled) sports = []
			})

		return () => {
			cancelled = true
		}
	})
</script>

<label
	for="sport"
	class="relative button px-[.5ch] py-[.25ch] hover:[&_svg]:rotate-45 {className}"
	title="Select sport"
>
	<BallIcon class="size-lh! shrink-0 transition-transform" />

	<select
		id="sport"
		class="absolute inset-0 opacity-0"
		onchange={(e) => {
			const url = new URL(page.url)

			if ((e.target as HTMLSelectElement).value !== '1') {
				url.searchParams.set('sportId', (e.target as HTMLSelectElement).value)
			} else {
				url.searchParams.delete('sportId')
			}

			goto(url.toString())
		}}
	>
		{#each sports ?? [] as sportId}
			<option
				value={sportId.id}
				selected={sportId.id === Number(sport)}
				disabled={available && !available.includes(sportId.id)}
			>
				{sportId.name}
			</option>
		{/each}
	</select>
</label>
