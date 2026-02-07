<script lang="ts">
	import { page } from '$app/state'
	import { fetchBoxscore, fetchLinescore } from '$lib/fetch'
	import { formatDate } from '$lib/temporal'
	import Linescore from '$ui/game/linescore.svelte'
	import ProbablePitchers from '$ui/game/probable-pitchers.svelte'
	import TeamScores from '$ui/game/team-scores.svelte'
	import Loading from '$ui/loading.svelte'

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

	const isGamePage = $derived(page.url.pathname === `/game/${game.gamePk}`)
</script>

<article class="group/game grid items-end {className}" data-gamePk={game.gamePk}>
	<div
		class="relative grid h-6 place-content-center overflow-x-clip text-center text-sm tabular-nums *:leading-none group-has-[[style*=linescore]]/game:h-12"
		style:grid-area="status"
	>
		{#if game.status.abstractGameState === 'Final'}
			{@const value =
				game.status.reason || game.status.detailedState || game.status.abstractGameState}
			<span>
				{value}{#if value === 'Final' && linescore?.currentInning! > linescore?.scheduledInnings!}/{linescore?.currentInning}{/if}
			</span>
		{:else}
			<time datetime={game.gameDate}>
				{formatDate(game.gameDate, { hour: '2-digit', minute: '2-digit' })}
			</time>
		{/if}

		{#if !isGamePage}
			<a class="absolute inset-0 text-[0px]" href="/game/{game.gamePk}">View details</a>
		{/if}
	</div>

	<span
		class="group/description grid items-end text-center text-xs font-light *:col-span-full *:row-span-full *:line-clamp-1"
		class:h-rlh={!isGamePage}
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

	<div style:grid-area="boxscore">
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

	{#if game.status.abstractGameState === 'Final'}
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
</article>

<style>
	article {
		grid-template:
			'status description' auto
			'status	boxscore' auto / 7ch 1fr;

		&:global(:has([style*='linescore'])) {
			grid-template:
				'status description linescore' auto
				'status	boxscore linescore' auto / 7ch 16ch minmax(18ch, 1fr);

			@media (width < 32rem) {
				grid-template:
					'. description description' auto
					'status boxscore linescore' auto / 7ch 6ch 1fr;
			}
		}
	}
</style>
