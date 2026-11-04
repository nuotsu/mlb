<script lang="ts">
	import { spoilerPreventionStore } from '#ui/spoiler-prevention/store.svelte.js'
	import { onMount } from 'svelte'
	import Chip from './chip.svelte'
	import { mlbTeams } from './mlb-teams.svelte.js'

	// Protected teams live in localStorage; swap them in after hydration
	let mounted = $state(false)
	onMount(() => (mounted = true))

	let protectedTeams = $derived(mounted ? spoilerPreventionStore.teams : [])
	let teams = $derived(mounted ? mlbTeams() : undefined)
	let names = $derived(new Map(teams?.map((t) => [t.id, t.name])))
	let unprotected = $derived(teams?.filter((t) => !spoilerPreventionStore.has(t.id)) ?? [])

	function add(id: number) {
		const team = teams?.find((t) => t.id === id)
		if (!team) return
		spoilerPreventionStore.add({
			id: team.id,
			abbreviation: team.abbreviation ?? team.teamName ?? team.name,
		})
	}
</script>

<section class="space-y-ch">
	<header class="flex items-baseline justify-between gap-ch">
		<h2 class="h3">Spoiler prevention</h2>
		{#if protectedTeams.length}
			<small class="text-xs text-current/60 tabular-nums">{protectedTeams.length}</small>
		{/if}
	</header>

	<p class="text-sm text-current/60">
		Scores and results for these teams stay hidden until you reveal them.
	</p>

	{#if protectedTeams.length}
		<ul class="flex flex-wrap gap-[.5ch]">
			{#each protectedTeams as team (team.id)}
				{@const name = names.get(team.id)}
				<Chip
					href="/teams/{team.id}"
					label={name ?? team.abbreviation}
					teamId={team.id}
					removeLabel="Show scores for {name ?? team.abbreviation}"
					onremove={() => spoilerPreventionStore.remove(team.id)}
				/>
			{/each}
		</ul>
	{/if}

	<label class="block text-sm">
		<span class="sr-only">Hide scores for a team</span>
		<select
			class="input min-h-11 w-full rounded px-ch"
			disabled={!unprotected.length}
			onchange={(e) => {
				add(Number(e.currentTarget.value))
				e.currentTarget.value = ''
			}}
		>
			<option value="" selected>
				{teams
					? unprotected.length
						? 'Hide scores for a team…'
						: 'All teams hidden'
					: 'Loading teams…'}
			</option>
			{#each unprotected as team (team.id)}
				<option value={team.id}>{team.name}</option>
			{/each}
		</select>
	</label>
</section>
