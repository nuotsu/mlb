<!--
	@component
	A KBO game's scoreboard for the page header: status, team scores and linescore, laid out like
	the MLB game card and built from the same components.
-->
<script lang="ts">
	import { toMlbGame, toMlbGameLinescore } from '#lib/kbo-game-mlb.js'
	import type { KboGame } from '#lib/kbo-game.js'
	import { cn } from '#lib/utils.js'
	import BaseRunners from '#ui/game/base-runners.svelte'
	import Inning from '#ui/game/inning.svelte'
	import Linescore from '#ui/game/linescore.svelte'
	import TeamScores from '#ui/game/team-scores.svelte'

	let { game, class: className }: { game: KboGame; class?: string } = $props()

	const mlbGame = $derived(toMlbGame(game))
	const linescore = $derived(toMlbGameLinescore(game))
	const boxscore = $derived({
		teams: {
			away: { team: mlbGame.teams.away.team },
			home: { team: mlbGame.teams.home.team },
		},
	} as unknown as MLB.Boxscore)

	const isLive = $derived(game.state === 'Live')
	const isFinal = $derived(game.state === 'Final' && !game.isCancelled)

	const status = $derived.by(() => {
		if (game.isCancelled) return mlbGame.status.reason ?? 'Postponed'
		if (game.state === 'Preview') return game.startTime ?? ''
		const innings = linescore.innings?.length ?? 0
		return isFinal && innings > 9 ? `Final/${innings}` : isFinal ? 'Final' : ''
	})
</script>

<article
	id="scoreboard"
	class={cn('group/game @container/game isolate grid items-end', className)}
	data-state={game.state}
>
	<div
		class={cn(
			'relative z-1 m-auto grid w-full text-center *:leading-none group-has-[[style*=linescore]]/game:h-12',
			(isLive || isFinal) && 'max-md:mt-rlh',
		)}
		style:grid-area="status"
	>
		<!-- Behind the status, as on the MLB scoreboard -->
		<div
			class={cn(
				'absolute top-1/2 left-1/2 -z-1 -translate-1/2',
				game.state !== 'Preview' && 'md:mt-1',
			)}
		>
			<BaseRunners class="w-max" linescore={isLive ? linescore : undefined} />
		</div>

		{#if isLive && game.currentInning}
			<Inning {linescore} />
		{:else}
			<b class="absolute inset-x-0 top-1/2 -translate-y-1/2 px-[.5ch] text-xs">{status}</b>
		{/if}
	</div>

	<div class="relative z-1" style:grid-area="boxscore">
		<TeamScores game={mlbGame} {boxscore} {linescore} />
	</div>

	{#if isLive || isFinal}
		<Linescore {linescore} game={mlbGame} poll={false} />
	{/if}
</article>

<style>
	article {
		--status-size: 5ch;

		grid-template: 'status boxscore' auto / var(--status-size) 1fr;

		&:global(:has([style*='linescore'])) {
			grid-template: 'status boxscore linescore' auto / var(--status-size) 1fr minmax(18ch, 57%);

			@media (width < 32rem) {
				grid-template: 'status boxscore linescore' auto / var(--status-size) minmax(5.5ch, 1fr) 57%;
			}
		}
	}
</style>
