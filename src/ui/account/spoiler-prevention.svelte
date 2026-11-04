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
</script>

<section class="space-y-ch">
	<h2 class="h3">Spoiler prevention</h2>

	{#if protectedTeams.length}
		<p class="text-sm text-current/60">
			Scores and results for these teams stay hidden until you reveal them.
		</p>

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
	{:else}
		<p class="text-sm text-current/60">
			Tap the eye on a <a class="link" href="/teams">team</a> to hide its scores and results until you
			reveal them.
		</p>
	{/if}
</section>
