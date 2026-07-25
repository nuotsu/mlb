<script lang="ts">
	import { browser } from '$app/environment'
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
	let teams = $state<MLB.Team[] | undefined>()

	$effect(() => {
		if (!browser) return

		const id = sportId ?? page.url.searchParams.get('sportId') ?? '1'
		let cancelled = false

		fetchMLB<MLB.TeamsResponse>('/api/v1/teams', {
			sportId: id,
			fields: ['teams,id,name'],
		})
			.then((data) => {
				if (!cancelled) teams = data.teams
			})
			.catch(() => {
				if (!cancelled) teams = []
			})

		return () => {
			cancelled = true
		}
	})
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

	{#each [...(teams ?? [])].sort((a, b) => a.name.localeCompare(b.name)) as t (t.id)}
		<option value={t.id} selected={t.id === Number(team)}>
			{t.name}
		</option>
	{/each}
</select>
