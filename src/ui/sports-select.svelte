<script lang="ts">
	import { goto } from '$app/navigation'
	import { page } from '$app/state'
	import { fetchMLB } from '$lib/fetch'

	let {
		class: className,
	}: {
		class?: string
	} = $props()

	let sport = $derived(page.url.searchParams.get('sportId') ?? '1')

	async function fetchSports() {
		return await fetchMLB<MLB.SportsResponse>('/api/v1/sports', { fields: ['sports,id,name'] })
	}
</script>

<select
	class={className}
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
	{#await fetchSports() then { sports }}
		{#each sports as sportId}
			<option value={sportId.id} selected={sportId.id === Number(sport)}>
				{sportId.name}
			</option>
		{/each}
	{/await}
</select>
