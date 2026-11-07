<script lang="ts">
	import { fetchMLB } from '#lib/fetch/index.js'
	import { favoritesStore } from '#ui/favorites/store.svelte.js'
	import Calendar from '#ui/schedule/calendar.svelte'
	import TeamCalendar from '#ui/team/team-calendar.svelte'
	import { onMount } from 'svelte'
	import Widget from '../widget.svelte'
	import type { WidgetData } from './index.js'

	let {}: { data: WidgetData } = $props()

	// Favorites live in localStorage; swap them in after hydration
	let mounted = $state(false)
	onMount(() => (mounted = true))

	const teamId = $derived(
		mounted
			? favoritesStore.favorites
					.find((f) => f.href.startsWith('/teams/'))
					?.href.split('/')
					.pop()
			: undefined,
	)

	const cache = new Map<string, Promise<MLB.TeamDetailed>>()

	function fetchTeam(id: string) {
		if (!cache.has(id)) {
			cache.set(
				id,
				fetchMLB<{ teams: MLB.TeamDetailed[] }>(`/api/v1/teams/${id}`, {
					fields: ['teams,id,name,abbreviation,sport'],
				}).then(({ teams: [team] }) => team),
			)
		}
		return cache.get(id)!
	}
</script>

{#if teamId}
	{#await fetchTeam(teamId)}
		<Widget title="Schedule" bodyClass="">
			<div class="h-[16lh] animate-pulse bg-current/5"></div>
		</Widget>
	{:then team}
		<Widget title="{team.name} schedule" href="/teams/{team.id}" linkLabel="Team" bodyClass="">
			<TeamCalendar {team} />
		</Widget>
	{:catch}
		{@render league()}
	{/await}
{:else}
	{@render league()}
{/if}

{#snippet league()}
	<Widget title="Calendar" href="/schedule/week" linkLabel="This week" bodyClass="">
		<Calendar />
		<p class="p-ch text-sm text-current/60">
			<a class="link" href="/teams">Star a team</a> to fill this with its schedule, results, and probable
			pitchers.
		</p>
	</Widget>
{/snippet}
