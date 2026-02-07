<script lang="ts">
	import { goto } from '$app/navigation'
	import { page } from '$app/state'
	import { fetchMLB } from '$lib/fetch'

	let {
		class: className,
		sportId,
	}: {
		class?: string
		sportId?: string
	} = $props()

	let team = $derived(page.url.searchParams.get('teamId') ?? '')

	async function fetchTeams() {
		return await fetchMLB<MLB.TeamsResponse>('/api/v1/teams', {
			sportId: sportId ?? page.url.searchParams.get('sportId') ?? '1',
			fields: ['teams,id,name,abbreviation'],
		})
	}
</script>

<select
	class={className}
	onchange={(e) => {
		const url = new URL(page.url)
		const value = (e.target as HTMLSelectElement).value

		if (value) {
			url.searchParams.set('teamId', value)
		} else {
			url.searchParams.delete('teamId')
		}

		goto(url.toString())
	}}
>
	<option value="" selected={!team}>All teams</option>

	{#await fetchTeams() then { teams }}
		{#each teams.sort((a, b) => a.name.localeCompare(b.name)) as t (t.id)}
			<option value={t.id} selected={t.id === Number(team)}>
				{t.abbreviation ?? t.name}
			</option>
		{/each}
	{/await}
</select>
