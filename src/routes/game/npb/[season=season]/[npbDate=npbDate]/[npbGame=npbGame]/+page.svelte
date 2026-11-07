<script lang="ts">
	import { npbGamePath, type NpbLang } from '#lib/npb-game.js'
	import type { NpbGameData } from '#lib/npb-game.js'
	import { NPB_SPORT_ID } from '#lib/npb.js'
	import { formatDate, slash } from '#lib/temporal.js'
	import { currentUrl, setViewParam } from '#lib/url.svelte.js'
	import { cn } from '#lib/utils.js'
	import ToggleFavorite from '#ui/favorites/toggle-favorite.svelte'
	import Header from '#ui/header.svelte'
	import {
		HomePlateIcon,
		InfoIcon,
		LanguageIcon,
		ListUnorderedIcon,
		PencilLineIcon,
		StrikezoneIcon,
		TrajectoryIcon,
	} from '#ui/icons/index.js'
	import Metadata from '#ui/metadata.svelte'
	import Boxscore from '#ui/npb-game/boxscore.svelte'
	import Decisions from '#ui/npb-game/decisions.svelte'
	import GameInfo from '#ui/npb-game/game-info.svelte'
	import HomeRuns from '#ui/npb-game/home-runs.svelte'
	import { LANG_PARAM, LANGS } from '#ui/npb-game/names.js'
	import Plays from '#ui/npb-game/plays.svelte'
	import Scoreboard from '#ui/npb-game/scoreboard.svelte'
	import Umpires from '#ui/npb-game/umpires.svelte'
	import SectionNav from '#ui/section-nav.svelte'
	import type { PageProps } from './$types'

	let { data }: PageProps = $props()

	/** Polled while the game is live; npb.jp is read at most every half minute behind the CDN */
	let polled = $state<NpbGameData | null>(null)

	const game = $derived(
		polled && polled.ref.code === data.game.ref.code && polled.ref.date === data.game.ref.date
			? polled
			: data.game,
	)

	$effect(() => {
		if (game.state !== 'Live') return

		const path = `/api/npb/game/${game.ref.season}/${game.ref.date}/${game.ref.code}`
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

	const lang = $derived<NpbLang>(currentUrl().searchParams.get(LANG_PARAM) === 'ja' ? 'ja' : 'en')
	const ja = $derived(lang === 'ja')

	const away = $derived(game.teams.away)
	const home = $derived(game.teams.home)

	const date = $derived(
		new Date(`${game.date}T12:00:00+09:00`).toLocaleDateString('en-US', {
			timeZone: 'Asia/Tokyo',
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
	<link rel="preconnect" href="https://p.npb.jp" />

	{@html `<script type="application/ld+json">${JSON.stringify({
		'@context': 'https://schema.org',
		'@type': 'SportsEvent',
		name: `${away.name ?? away.nameJa} at ${home.name ?? home.nameJa}`,
		startDate: `${game.date}T${game.startTime ?? '18:00'}:00+09:00`,
		location: game.venueJa ? { '@type': 'Place', name: game.venueJa } : undefined,
		awayTeam: { '@type': 'SportsTeam', name: away.name ?? away.nameJa },
		homeTeam: { '@type': 'SportsTeam', name: home.name ?? home.nameJa },
		url: `https://mlb.theohtani.com${npbGamePath(game.ref)}`,
		organizer: { '@type': 'SportsOrganization', name: 'Nippon Professional Baseball' },
		sport: 'https://en.wikipedia.org/wiki/Baseball',
	})}<\/script>`}
</svelte:head>

<Metadata
	title="{[away.teamName ?? away.nameJa, home.teamName ?? home.nameJa].join(
		' @ ',
	)} ({date}) | MLB.TheOhtani.com"
	description="NPB game details for {[away.name ?? away.nameJa, home.name ?? home.nameJa].join(
		' at ',
	)} on {date}"
/>

<Header
	class="max-sm:px-0 max-sm:[&_nav]:pl-ch"
	crumbs={[
		// As on MLB game pages, on npb.jp's (Japan) date, which the NPB schedule lists it under
		{
			href: `/schedule/week/${game.date}?sportId=${NPB_SPORT_ID}`,
			name: 'Weekly Schedule',
		},
		{
			href: `/schedule/day/${game.date}?sportId=${NPB_SPORT_ID}`,
			name: formatDate(slash(game.date), { weekday: 'short', month: 'short', day: 'numeric' }),
		},
		{ name: `${away.abbreviation ?? away.shortNameJa} @ ${home.abbreviation ?? home.shortNameJa}` },
	]}
>
	<Scoreboard class="w-full" {game} {lang} />
</Header>

<section class="group/game-page grid gap-[2lh] py-lh md:grid-cols-2">
	{#if game.plays}
		<Plays class="col-span-full max-h-[14lh]" {game} names={game.names} {lang} />
	{/if}

	<!-- As on the MLB game page: details, then the favorite button; first once the game is over -->
	<div
		id="game-info"
		class={cn('col-span-full m-auto px-ch', game.state === 'Final' && 'order-first')}
	>
		<GameInfo {game} {lang} />

		<hr class="my-ch border-dashed border-stroke" />

		<menu class="flex items-center justify-center gap-ch">
			<li>
				<ToggleFavorite
					target={{
						href: npbGamePath(game.ref),
						label: [
							away.abbreviation ?? away.shortNameJa,
							home.abbreviation ?? home.shortNameJa,
						].join(' @ '),
					}}
				>
					Favorite
				</ToggleFavorite>
			</li>
		</menu>
	</div>

	{#if game.state !== 'Preview'}
		<Boxscore class="col-span-full" {game} names={game.names} {lang} />
	{/if}

	{#if game.decisions.win || game.decisions.loss || game.decisions.save}
		<div
			class="col-span-full flex flex-wrap items-start justify-evenly gap-lh px-[2ch] *:grow *:only:mx-auto *:only:max-w-max"
		>
			<Decisions {game} names={game.names} {lang} />
		</div>
	{/if}

	<HomeRuns class="col-span-full px-[2ch]" {game} names={game.names} {lang} />

	<Umpires class="col-span-full" {game} {lang} />

	<p class="col-span-full px-ch text-center text-xs text-current/50">
		{ja ? '出典' : 'Game data from'}
		<a class="link" href={game.url} target="_blank" rel="noopener noreferrer">NPB.jp 日本野球機構</a
		>
		{#if !ja}
			<br />
			English names are from current team rosters; others are shown in Japanese.
		{/if}
	</p>
</section>

<SectionNav sections={SECTIONS} label="Game sections">
	{#snippet after()}
		<label
			class="relative flex h-9 shrink-0 items-center gap-[.5ch] rounded-full px-2 text-foreground/60 transition-colors focus-within:ring-2 focus-within:ring-accent focus-within:ring-inset pointer-fine:hover:bg-accent/25 pointer-fine:hover:text-foreground"
			title={ja ? '言語' : 'Language'}
		>
			<LanguageIcon class="size-[1.125rem] shrink-0" aria-hidden="true" />
			<select
				class="cursor-pointer appearance-none bg-transparent text-xs outline-none"
				aria-label={ja ? '言語' : 'Language'}
				value={lang}
				onchange={(e) => setViewParam(LANG_PARAM, e.currentTarget.value, 'en')}
			>
				{#each LANGS as option (option.id)}
					<option value={option.id}>{option.label}</option>
				{/each}
			</select>
		</label>
	{/snippet}
</SectionNav>

<style>
	section {
		padding-bottom: max(1ch, env(safe-area-inset-bottom));

		:global([id]) {
			scroll-margin-top: calc(var(--header-height, 0px) + 1ch);
		}
	}
</style>
