<script lang="ts">
	import { kboGamePath, translateVenue, type KboGame } from '#lib/kbo-game.js'
	import { KBO_SPORT_ID } from '#lib/kbo.js'
	import { formatDate, slash } from '#lib/temporal.js'
	import { cn } from '#lib/utils.js'
	import ToggleFavorite from '#ui/favorites/toggle-favorite.svelte'
	import Header from '#ui/header.svelte'
	import {
		HomePlateIcon,
		InfoIcon,
		ListUnorderedIcon,
		PencilLineIcon,
		StrikezoneIcon,
		TrajectoryIcon,
	} from '#ui/icons/index.js'
	import Boxscore from '#ui/kbo-game/boxscore.svelte'
	import Decisions from '#ui/kbo-game/decisions.svelte'
	import GameInfo from '#ui/kbo-game/game-info.svelte'
	import HomeRuns from '#ui/kbo-game/home-runs.svelte'
	import Plays from '#ui/kbo-game/plays.svelte'
	import Scoreboard from '#ui/kbo-game/scoreboard.svelte'
	import Umpires from '#ui/kbo-game/umpires.svelte'
	import Metadata from '#ui/metadata.svelte'
	import SectionNav from '#ui/section-nav.svelte'
	import type { PageProps } from './$types'

	let { data }: PageProps = $props()

	/** Polled while the game is live; koreabaseball.com is read at most every half minute */
	let polled = $state<KboGame | null>(null)

	const game = $derived(polled && polled.id === data.game.id ? polled : data.game)

	$effect(() => {
		if (game.state !== 'Live') return

		const path = `/api/kbo/game/${game.id}`
		const timer = setInterval(async () => {
			try {
				const response = await fetch(path)
				if (response.ok) polled = await response.json()
			} catch {
				// Keep what's on screen; the next tick tries again
			}
		}, 30_000)

		return () => clearInterval(timer)
	})

	const away = $derived(game.teams.away)
	const home = $derived(game.teams.home)

	const date = $derived(
		new Date(`${game.date}T12:00:00+09:00`).toLocaleDateString('en-US', {
			timeZone: 'Asia/Seoul',
			month: 'short',
			day: 'numeric',
			year: 'numeric',
		}),
	)

	const SECTIONS = [
		{ id: 'scoreboard', label: 'Scoreboard', icon: HomePlateIcon },
		{ id: 'plays', label: 'Plays', icon: ListUnorderedIcon },
		{ id: 'game-info', label: 'Game info', icon: InfoIcon },
		{ id: 'boxscore', label: 'Box score', icon: PencilLineIcon },
		{ id: 'home-runs', label: 'Home runs', icon: TrajectoryIcon },
		{ id: 'umpires', label: 'Umpires', icon: StrikezoneIcon },
	]
</script>

<svelte:head>
	<link rel="preconnect" href="https://6ptotvmi5753.edge.naverncp.com" />

	{@html `<script type="application/ld+json">${JSON.stringify({
		'@context': 'https://schema.org',
		'@type': 'SportsEvent',
		name: `${away.name} at ${home.name}`,
		startDate: `${game.date}T${game.startTime ?? '18:30'}:00+09:00`,
		location: game.venueKo ? { '@type': 'Place', name: translateVenue(game.venueKo) } : undefined,
		awayTeam: { '@type': 'SportsTeam', name: away.name },
		homeTeam: { '@type': 'SportsTeam', name: home.name },
		url: `https://mlb.theohtani.com${kboGamePath(game.id)}`,
		organizer: { '@type': 'SportsOrganization', name: 'Korea Baseball Organization' },
		sport: 'https://en.wikipedia.org/wiki/Baseball',
	})}<\/script>`}
</svelte:head>

<Metadata
	title="{away.teamName} @ {home.teamName} ({date}) | MLB.TheOhtani.com"
	description="KBO game details for {away.name} at {home.name} on {date}"
/>

<Header
	class="max-sm:px-0 max-sm:[&_nav]:pl-ch"
	crumbs={[
		// As on MLB game pages, on koreabaseball.com's (Korea) date, which the KBO schedule lists it under
		{
			href: `/schedule/week/${game.date}?sportId=${KBO_SPORT_ID}`,
			name: 'Weekly Schedule',
		},
		{
			href: `/schedule/day/${game.date}?sportId=${KBO_SPORT_ID}`,
			name: formatDate(slash(game.date), { weekday: 'short', month: 'short', day: 'numeric' }),
		},
		{ name: `${away.abbreviation} @ ${home.abbreviation}` },
	]}
>
	<Scoreboard class="w-full" {game} />
</Header>

<section class="group/game-page grid gap-[2lh] py-lh md:grid-cols-2">
	{#if game.plays?.length}
		<Plays class="col-span-full max-h-[14lh]" {game} />
	{/if}

	<!-- As on the MLB game page: details, then the favorite button; first once the game is over -->
	<div
		id="game-info"
		class={cn('col-span-full m-auto px-ch', game.state === 'Final' && 'order-first')}
	>
		<GameInfo {game} />

		<hr class="my-ch border-dashed border-stroke" />

		<menu class="flex items-center justify-center gap-ch">
			<li>
				<ToggleFavorite
					target={{
						href: kboGamePath(game.id),
						label: `${away.abbreviation} @ ${home.abbreviation}`,
					}}
				>
					Favorite
				</ToggleFavorite>
			</li>
		</menu>
	</div>

	{#if game.state !== 'Preview' && !game.isCancelled}
		<Boxscore class="col-span-full" {game} />
	{/if}

	{#if game.decisions.win || game.decisions.loss || game.decisions.save}
		<div
			class="col-span-full flex flex-wrap items-start justify-evenly gap-lh px-[2ch] *:grow *:only:mx-auto *:only:max-w-max"
		>
			<Decisions {game} />
		</div>
	{/if}

	<HomeRuns class="col-span-full px-[2ch]" {game} />

	<Umpires class="col-span-full" {game} />

	<p class="col-span-full px-ch text-center text-xs text-current/50">
		<small class="text-xs">
			Game data from
			<a class="link" href={game.url} target="_blank" rel="noopener noreferrer"
				>KBO 한국야구위원회 (koreabaseball.com)</a
			>
			<br />
			Player names are KBO's, in Korean; plays are put together from the box score.
		</small>
	</p>
</section>

<SectionNav sections={SECTIONS} label="Game sections" />

<style>
	section {
		padding-bottom: max(1ch, env(safe-area-inset-bottom));

		:global([id]) {
			scroll-margin-top: calc(var(--header-height, 0px) + 1ch);
		}
	}
</style>
