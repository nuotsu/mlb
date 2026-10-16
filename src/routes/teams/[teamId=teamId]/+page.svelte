<script lang="ts">
	import { formatDate } from '#lib/temporal.js'
	import { cn } from '#lib/utils.js'
	import Divider from '#ui/divider.svelte'
	import Empty from '#ui/empty.svelte'
	import ToggleFavorite from '#ui/favorites/toggle-favorite.svelte'
	import Header from '#ui/header.svelte'
	import Loading from '#ui/loading.svelte'
	import Metadata from '#ui/metadata.svelte'
	import ToggleSpoilerPrevention from '#ui/spoiler-prevention/toggle-spoiler-prevention.svelte'
	import InjuredList from '#ui/team/injured-list.svelte'
	import Logo from '#ui/team/logo.svelte'
	import Roster from '#ui/team/roster.svelte'
	import SelectSeason from '#ui/team/select-season.svelte'
	import SeriesCalendar from '#ui/team/series-calendar.svelte'
	import SeriesList from '#ui/team/series-list.svelte'
	import type { PageProps } from './$types'

	let { data }: PageProps = $props()

	const team = $derived(data.team as MLB.TeamDetailed)
	const isCurrentSeason = $derived(data.season === Number(data.today.slice(0, 4)))
	const isToday = $derived(data.date === data.today)
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
	<SelectSeason class="px-ch" {team} season={data.season} date={data.date} today={data.today} />

	<div class="space-y-ch">
		<SeriesCalendar {team} season={data.season} date={data.date} />
	</div>

	<div class="space-y-ch">
		<SeriesList {team} season={data.season} />
	</div>

	<div class="space-y-ch">
		<Divider>{isCurrentSeason ? 'Active Roster' : `${data.season} Roster`}</Divider>

		{#await Promise.all([data.roster, data.coaches])}
			<Loading class="justify-center p-lh text-current/40">Loading roster...</Loading>
		{:then [roster, coaches]}
			{#if roster?.length || coaches.length}
				<div class="grid gap-y-ch md:grid-cols-[repeat(auto-fill,minmax(var(--container-xs),1fr))]">
					<Roster roster={roster ?? []} {coaches} />
				</div>
			{:else}
				<Empty>{roster ? `No roster for ${data.season}` : 'Failed to load roster'}</Empty>
			{/if}
		{/await}
	</div>

	<div class="space-y-ch">
		<Divider>
			Injured List{#if !isToday}
				{' '}as of {formatDate(data.date, { month: 'short', day: 'numeric', year: 'numeric' })}{/if}
		</Divider>

		{#await data.injuredList}
			<Loading class="justify-center p-lh text-current/40">Loading injured list...</Loading>
		{:then injuredList}
			{#if injuredList?.length}
				<InjuredList players={injuredList} asOf={data.date} />
			{:else}
				<Empty>
					{injuredList
						? `No players on the IL${isToday ? '' : ' that day'}`
						: 'Failed to load injured list'}
				</Empty>
			{/if}
		{/await}
	</div>
</section>
