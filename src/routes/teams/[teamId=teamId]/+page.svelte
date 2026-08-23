<script lang="ts">
	import { cn } from '$lib/utils'
	import Divider from '$ui/divider.svelte'
	import Empty from '$ui/empty.svelte'
	import ToggleFavorite from '$ui/favorites/toggle-favorite.svelte'
	import Header from '$ui/header.svelte'
	import Loading from '$ui/loading.svelte'
	import Metadata from '$ui/metadata.svelte'
	import ToggleSpoilerPrevention from '$ui/spoiler-prevention/toggle-spoiler-prevention.svelte'
	import InjuredList from '$ui/team/injured-list.svelte'
	import Logo from '$ui/team/logo.svelte'
	import Roster from '$ui/team/roster.svelte'
	import SeriesCalendar from '$ui/team/series-calendar.svelte'
	import TeamCalendar from '$ui/team/team-calendar.svelte'
	import type { PageProps } from './$types'

	let { data }: PageProps = $props()

	const team = $derived(data.team as MLB.TeamDetailed)
</script>

<svelte:head>
	{@html `<script type="application/ld+json">${JSON.stringify({
		'@context': 'https://schema.org',
		'@type': 'SportsTeam',
		name: team.name,
		sport: 'https://en.wikipedia.org/wiki/Baseball',
		url: `https://mlb.theohtani.com/teams/${team.id}`,
		memberOf: {
			'@type': 'SportsOrganization',
			name: 'Major League Baseball',
			url: 'https://www.mlb.com',
		},
	})}<\/script>`}
</svelte:head>

<Metadata title="{team.name} | MLB.TheOhtani.com" description="{team.name} team page" />

<Header
	crumbs={[
		{ href: '/teams', name: 'Teams' },
		team.sport?.name ? { href: `/teams?sportId=${team.sport?.id}`, name: team.sport.name } : {},
		{ name: team.name },
	]}
>
	<div
		class={cn(
			'flex flex-wrap gap-ch',
			team.franchiseName !== team.clubName ? 'items-end' : 'items-center',
		)}
	>
		{#key team.id}
			<Logo class="size-[3lh] shrink-0 rounded-none bg-transparent" {team} />
		{/key}

		<h1 class="grid">
			{#if team.franchiseName !== team.clubName}
				<span>{team.franchiseName}</span>
			{/if}

			<strong class="text-3xl">{team.clubName}</strong>
		</h1>
	</div>

	{#snippet after()}
		<div class="mx-auto flex items-center justify-center gap-ch">
			<ToggleSpoilerPrevention team={{ id: team.id, abbreviation: team.abbreviation! }} />
			<ToggleFavorite target={{ href: `/teams/${team.id}`, label: team.abbreviation! }} />
		</div>
	{/snippet}
</Header>

<section class="grid gap-lh pt-lh pb-[max(1lh,env(safe-area-inset-bottom))]">
	<div class="px-ch">
		<TeamCalendar {team} />
	</div>

	<div class="space-y-ch">
		<SeriesCalendar {team} />
	</div>

	<div class="space-y-ch">
		<Divider>Roster</Divider>

		{#if data.roster.roster}
			<div class="grid gap-y-ch md:grid-cols-[repeat(auto-fill,minmax(var(--container-xs),1fr))]">
				<Roster roster={data.roster.roster} coaches={data.coaches.roster} />
			</div>
		{:else}
			<Empty>No roster</Empty>
		{/if}
	</div>

	<div class="space-y-ch">
		<Divider>Injured List</Divider>

		{#await data.injuredList}
			<Loading class="justify-center p-lh text-current/40">Loading injured list...</Loading>
		{:then injuredList}
			{#if injuredList?.length}
				<InjuredList players={injuredList} />
			{:else}
				<Empty>{injuredList ? 'No players on the IL' : 'Failed to load injured list'}</Empty>
			{/if}
		{/await}
	</div>
</section>
