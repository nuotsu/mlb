<!--
	@component
	An NPB game on the schedule pages: the MLB game card, fed npb.jp's schedule and the game's
	linescore in the Stats API's shapes, and linking to our NPB game page.
-->
<script lang="ts">
	import {
		toMlbScheduleFeed,
		toMlbScheduleGame,
		toMlbScheduleLinescore,
	} from '#lib/npb-game-mlb.js'
	import { npbGamePath } from '#lib/npb-game.js'
	import type { NpbScheduleGame } from '#lib/npb-schedule.js'
	import Game from '#ui/game/game.svelte'

	let { game }: { game: NpbScheduleGame } = $props()

	const mlbGame = $derived(toMlbScheduleGame(game))
	const linescore = $derived(toMlbScheduleLinescore(game.linescore))
	/** The card shows this instead of polling the Stats API, which has no NPB games */
	const feed = $derived(toMlbScheduleFeed(mlbGame, linescore))
	const boxscore = $derived({
		teams: {
			away: { team: mlbGame.teams.away.team },
			home: { team: mlbGame.teams.home.team },
		},
	} as unknown as MLB.Boxscore)
</script>

<Game
	game={mlbGame}
	{boxscore}
	{linescore}
	{feed}
	href={npbGamePath(game.ref)}
	seriesRecord={game.series}
	showDescription
	{pregame}
/>

<!-- The probable starters, laid out like the MLB card's; npb.jp gives just their names -->
{#snippet pregame()}
	{#if game.pitchers.away || game.pitchers.home}
		<div class="z-1 grid grid-cols-2 backdrop-blur-xs" style:grid-area="pregame" lang="ja">
			{#each [game.pitchers.away, game.pitchers.home] as pitcher, i (i)}
				<div>
					{#if pitcher}
						<span
							class="flex items-center justify-between gap-ch {i === 0
								? 'flex-row-reverse pl-ch'
								: 'pr-ch'}"
						>
							<span class="line-clamp-1 break-all">{pitcher}</span>
						</span>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
{/snippet}
