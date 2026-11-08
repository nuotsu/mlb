<script lang="ts">
	import { KBO_REGISTER_URL } from '#lib/kbo-roster.js'
	import { KBO_SPORT_ID } from '#lib/kbo.js'
	import { npbRosterUrl } from '#lib/npb-roster.js'
	import { NPB_SPORT_ID } from '#lib/npb.js'
	import { cn } from '#lib/utils.js'
	import Divider from '#ui/divider.svelte'
	import Empty from '#ui/empty.svelte'
	import ToggleFavorite from '#ui/favorites/toggle-favorite.svelte'
	import Header from '#ui/header.svelte'
	import Loading from '#ui/loading.svelte'
	import Metadata from '#ui/metadata.svelte'
	import ToggleSpoilerPrevention from '#ui/spoiler-prevention/toggle-spoiler-prevention.svelte'
	import InjuredList from '#ui/team/injured-list.svelte'
	import KboRoster from '#ui/team/kbo-roster.svelte'
	import { fetchKboTeamSchedule } from '#ui/team/kbo-team-schedule.js'
	import Logo from '#ui/team/logo.svelte'
	import NpbRoster from '#ui/team/npb-roster.svelte'
	import { fetchNpbTeamSchedule } from '#ui/team/npb-team-schedule.js'
	import Roster from '#ui/team/roster.svelte'
	import SectionNav from '#ui/team/section-nav.svelte'
	import { DATE_PARAM, getDateForMonth, getSelectedDate } from '#ui/team/selected-date.js'
	import SeriesCalendar from '#ui/team/series-calendar.svelte'
	import TeamCalendar from '#ui/team/team-calendar.svelte'
	import { goto } from '$app/navigation'
	import { page } from '$app/state'
	import type { PageProps } from './$types'

	let { data }: PageProps = $props()

	const team = $derived(data.team as MLB.TeamDetailed)

	/** NPB teams load their roster and schedule from npb.jp instead, and have no IL */
	const isNpb = $derived(data.npb !== undefined)

	/** KBO teams likewise, from koreabaseball.com */
	const isKbo = $derived(data.kbo !== undefined)

	/** The league site's schedule for the calendars, as the Stats API has none for NPB or KBO */
	const loadSchedule = $derived(
		isNpb
			? (season: number) => fetchNpbTeamSchedule(team.id, season)
			: isKbo
				? (season: number) => fetchKboTeamSchedule(team.id, season)
				: undefined,
	)

	/** The Stats API files some NPB teams under International Baseball, so name the league here */
	const sportCrumb = $derived(
		isNpb
			? { href: `/teams?sportId=${NPB_SPORT_ID}`, name: 'Nippon Professional Baseball' }
			: isKbo
				? { href: `/teams?sportId=${KBO_SPORT_ID}`, name: 'Korea Baseball Organization' }
				: team.sport?.name
					? { href: `/teams?sportId=${team.sport?.id}`, name: team.sport.name }
					: {},
	)

	/** Single source of truth: the roster, calendars, and IL all follow it */
	const date = $derived(getSelectedDate(page.url))

	/**
	 * Month just picked, held only while its date resolves and the page reloads
	 * so the picker responds immediately; the URL takes over once it lands.
	 */
	let pendingMonth = $state<string | null>(null)
	let latestPick = 0

	async function selectMonth(month: string) {
		const pick = ++latestPick
		const from = date
		pendingMonth = month

		try {
			const next = await getDateForMonth(month, from, team)
			// A newer pick (or the server load for one) supersedes this one
			if (pick !== latestPick || next === from) return

			pendingMonth = next.slice(0, 7)

			const url = new URL(page.url.href)
			url.searchParams.set(DATE_PARAM, next)
			await goto(url, { reset: false })
		} finally {
			if (pick === latestPick) pendingMonth = null
		}
	}
</script>

<svelte:head>
	{#if isNpb}
		<link rel="preconnect" href="https://p.npb.jp" />
	{:else if isKbo}
		<link rel="preconnect" href="https://6ptotvmi5753.edge.naverncp.com" />
	{/if}
	{@html `<script type="application/ld+json">${JSON.stringify({
		'@context': 'https://schema.org',
		'@type': 'SportsTeam',
		name: team.name,
		sport: 'https://en.wikipedia.org/wiki/Baseball',
		url: `https://mlb.theohtani.com/teams/${team.id}`,
		memberOf: isNpb
			? {
					'@type': 'SportsOrganization',
					name: 'Nippon Professional Baseball',
					url: 'https://npb.jp/eng/',
				}
			: isKbo
				? {
						'@type': 'SportsOrganization',
						name: 'Korea Baseball Organization',
						url: 'https://www.koreabaseball.com/',
					}
				: {
						'@type': 'SportsOrganization',
						name: 'Major League Baseball',
						url: 'https://www.mlb.com',
					},
	})}<\/script>`}
</svelte:head>

<Metadata
	title="{team.name} | MLB.TheOhtani.com"
	description={isNpb || isKbo
		? `${team.name} schedule and roster`
		: `${team.name} roster, injured list, and recent transactions`}
/>

<Header crumbs={[{ href: '/teams', name: 'Teams' }, sportCrumb, { name: team.name }]}>
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
			{#if !isNpb && !isKbo}
				<ToggleSpoilerPrevention team={{ id: team.id, abbreviation: team.abbreviation! }} />
			{/if}
			<ToggleFavorite
				target={{ href: `/teams/${team.id}`, label: team.abbreviation! }}
				fullName={team.name}
			/>
		</div>
	{/snippet}
</Header>

<section class="team-page grid gap-lh pt-lh pb-[max(1lh,env(safe-area-inset-bottom))]">
	<div class="px-ch">
		<TeamCalendar
			{team}
			{loadSchedule}
			bind:value={() => pendingMonth ?? date.slice(0, 7), selectMonth}
		/>
	</div>

	<div id="series-calendar" class="space-y-ch">
		<SeriesCalendar {team} {date} {loadSchedule} />
	</div>

	{#if isNpb}
		<div class="space-y-ch">
			<Divider>Roster</Divider>

			{#if data.npb}
				<div class="grid gap-y-ch md:grid-cols-[repeat(auto-fill,minmax(var(--container-xs),1fr))]">
					<NpbRoster roster={data.npb} />
				</div>

				<small class="block px-ch text-center text-xs text-current/50">
					{data.npb.status ? `${data.npb.status} roster` : 'Roster'} from
					<a class="link" href={npbRosterUrl(team.id)} target="_blank" rel="noopener noreferrer"
						>NPB.jp 日本野球機構</a
					>
				</small>
			{:else}
				<Empty>Failed to load roster</Empty>
			{/if}
		</div>
	{:else if isKbo}
		<div class="space-y-ch">
			<Divider>Roster</Divider>

			{#if data.kbo}
				<div class="grid gap-y-ch md:grid-cols-[repeat(auto-fill,minmax(var(--container-xs),1fr))]">
					<KboRoster roster={data.kbo} />
				</div>

				<small class="block px-ch text-center text-xs text-current/50">
					First-team roster as of {data.kbo.date} from
					<a class="link" href={KBO_REGISTER_URL} target="_blank" rel="noopener noreferrer"
						>KBO 한국야구위원회 (koreabaseball.com)</a
					>
				</small>
			{:else}
				<Empty>Failed to load roster</Empty>
			{/if}
		</div>
	{:else}
		<div class="space-y-ch">
			<Divider>Roster</Divider>

			{#if data.roster?.roster}
				<div class="grid gap-y-ch md:grid-cols-[repeat(auto-fill,minmax(var(--container-xs),1fr))]">
					<Roster roster={data.roster.roster} coaches={data.coaches?.roster ?? []} />
				</div>
			{:else}
				<Empty>No roster</Empty>
			{/if}
		</div>

		<div id="injured-list" class="space-y-ch">
			<Divider>Injured List</Divider>

			{#await data.injuredList}
				<Loading class="justify-center p-lh text-current/40">Loading injured list...</Loading>
			{:then injuredList}
				{#if injuredList?.length}
					<InjuredList players={injuredList} today={date} />
				{:else}
					<Empty>{injuredList ? 'No players on the IL' : 'Failed to load injured list'}</Empty>
				{/if}
			{/await}
		</div>
	{/if}
</section>

<SectionNav />

<style>
	/* Land section titles below the sticky header when jumping to them */
	.team-page :global([id]) {
		scroll-margin-top: calc(var(--header-height, 0px) + 1ch);
	}
</style>
