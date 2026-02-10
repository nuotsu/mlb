<script lang="ts">
	import { page } from '$app/state'
	import { fetchBoxscore, fetchLinescore } from '$lib/fetch'
	import { formatDate } from '$lib/temporal'
	import Linescore from '$ui/game/linescore.svelte'
	import ProbablePitchers from '$ui/game/probable-pitchers.svelte'
	import TeamScores from '$ui/game/team-scores.svelte'
	import Loading from '$ui/loading.svelte'
	import BaseRunners from './base-runners.svelte'

	let {
		game,
		boxscore,
		linescore,
		showDescription,
		class: className = '',
	}: {
		game: MLB.Game
		boxscore?: MLB.Boxscore
		linescore?: MLB.Linescore
		showDescription?: boolean
		class?: string
	} = $props()

	const { flags } = $derived(game as unknown as { flags: MLB.GameFlags })

	const isFinal = $derived(game.status.abstractGameState === 'Final')
	const isGamePage = $derived(page.url.pathname === `/game/${game.gamePk}`)
</script>

<article
	class="group/game @container/game isolate grid items-end {className}"
	data-gamePk={game.gamePk}
>
	<div
		class="relative z-1 m-auto grid h-6 pt-[0.75rlh] text-center *:leading-none group-has-[[style*=linescore]]/game:h-12"
		style:grid-area="status"
	>
		<BaseRunners
			className="m-auto absolute left-1/2 top-1/2 -translate-1/2 w-max mt-[.5rlh] max-md:group-has-[[style*=linescore]]/game:mt-[.5lh]"
		/>

		{#if isFinal}
			{@const value =
				game.status.reason || game.status.detailedState || game.status.abstractGameState}
			<span class="m-auto text-xs font-bold">
				{value}{#if value === 'Final' && linescore?.currentInning! > linescore?.scheduledInnings!}/{linescore?.currentInning}{/if}
			</span>
		{:else}
			<time class="m-auto text-xs font-bold" datetime={game.gameDate}>
				{formatDate(game.gameDate, { hour: 'numeric', minute: '2-digit' })}
			</time>
		{/if}
	</div>

	<span
		class="group/description grid items-end text-center text-xs font-light *:col-span-full *:row-span-full *:line-clamp-1"
		class:min-h-rlh={!isGamePage || (isGamePage && !isFinal)}
		style:grid-area="description"
	>
		{#if !isGamePage}
			{#if showDescription}
				{#if game.description}
					<span>{game.description}</span>
				{:else if game.seriesGameNumber && game.gamesInSeries && game.gamesInSeries > 1}
					<span class="text-current/50">
						Series {game.seriesGameNumber} of {game.gamesInSeries}
					</span>
				{/if}
			{/if}

			{#if flags?.perfectGame || flags?.noHitter}
				<strong
					class="border bg-background font-bold text-red-500 group-has-hover/description:hidden"
				>
					{#if flags.perfectGame}
						Perfect game
					{:else if flags.noHitter}
						No-hitter
					{/if}
				</strong>
			{/if}
		{/if}
	</span>

	<div class="relative z-1 bg-background" style:grid-area="boxscore">
		{#if boxscore}
			<TeamScores {game} {boxscore} />
		{:else}
			{#await fetchBoxscore(game.gamePk)}
				<Loading>Loading...</Loading>
			{:then data}
				<TeamScores {game} boxscore={data} />
			{/await}
		{/if}
	</div>

	{#if isFinal}
		{#if linescore}
			<Linescore {linescore} />
		{:else}
			{#await fetchLinescore(game.gamePk) then data}
				<Linescore linescore={data} />
			{/await}
		{/if}
	{:else}
		<ProbablePitchers />
	{/if}

	{#if !isGamePage}
		<div
			class="text-center text-xs font-light group-not-hover/game:transition-[translate,opacity] md:group-not-hover/game:-translate-y-full md:group-not-hover/game:opacity-0"
			style:grid-area="link"
		>
			<a
				class="inline-grid h-rlh place-content-center text-current/50 hover:text-current"
				href="/game/{game.gamePk}"
			>
				See details
			</a>
		</div>
	{/if}
</article>

<style>
	article {
		--status-size: 6ch;

		grid-template:
			'status description' auto
			'status boxscore' auto
			'. link' auto / var(--status-size) 1fr;

		&:global(:has([style*='linescore'])) {
			grid-template:
				'status description linescore' auto
				'status boxscore linescore' auto
				'. link .' auto / var(--status-size) 1fr minmax(18ch, 50%);

			@media (width < 32rem) {
				grid-template:
					'. description description' auto
					'status boxscore linescore' auto
					'. link .' auto / var(--status-size) minmax(5.5ch, 1fr) 50%;
			}
		}
	}

	[style*='boxscore'] {
		--inset: 0.5ch;
		clip-path: polygon(
			0 0,
			100% 0,
			100% 100%,
			0 100%,
			0 calc(50% + var(--inset)),
			var(--inset) 50%,
			0 calc(50% - var(--inset))
		);
	}
</style>
