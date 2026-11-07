<!--
	@component
	An NPB game on the schedule pages, laid out like the MLB game card (`#ui/game/game.svelte`) and
	built from the same pieces, from what npb.jp's schedule has: the score and W/L pitchers once
	played, the probable starters the day before. It links to the game's page for the rest.
-->
<script lang="ts">
	import { toMlbScheduleGame } from '#lib/npb-game-mlb.js'
	import { npbGamePath, translateStatus, translateVenue } from '#lib/npb-game.js'
	import type { NpbScheduleGame } from '#lib/npb-schedule.js'
	import { cn } from '#lib/utils.js'
	import Status from '#ui/game/status.svelte'
	import TeamScores from '#ui/game/team-scores.svelte'
	import { ChevronRightIcon } from '#ui/icons/index.js'

	let { game, class: className }: { game: NpbScheduleGame; class?: string } = $props()

	const mlbGame = $derived(toMlbScheduleGame(game))
	const boxscore = $derived({
		teams: {
			away: { team: mlbGame.teams.away.team },
			home: { team: mlbGame.teams.home.team },
		},
	} as unknown as MLB.Boxscore)

	/** The live score, where the MLB card reads it from */
	const linescore = $derived({
		teams: {
			away: { runs: game.teams.away.runs ?? undefined },
			home: { runs: game.teams.home.runs ?? undefined },
		},
	} as unknown as MLB.Linescore)

	const isLive = $derived(game.state === 'Live')
	const isFinal = $derived(game.state === 'Final' && !game.isCancelled)
	const href = $derived(npbGamePath(game.ref))

	const { pitchers } = $derived(game)
	const decisions = $derived(
		[
			['W', pitchers.win],
			['L', pitchers.loss],
			['SV', pitchers.save],
		].filter((decision): decision is [string, string] => !!decision[1]),
	)
</script>

<article
	class={cn('group/game @container/game isolate grid items-end', className)}
	data-npb-game={game.ref.code}
>
	<div
		class={cn(
			'relative z-1 m-auto grid w-full text-center *:leading-none',
			(isLive || isFinal) && 'max-md:mt-rlh',
		)}
		style:grid-area="status"
	>
		{#if isLive || game.isCancelled}
			<!-- npb.jp's schedule has no linescore, just its status line; long ones go smaller, as on
			the NPB scoreboard, to fit the column -->
			{@const status = game.statusJa ? translateStatus(game.statusJa) : 'Live'}
			<b
				class={cn(
					'absolute inset-x-0 top-1/2 -translate-y-1/2 px-[.5ch]',
					status.length > 6 ? 'text-[x-small]' : 'text-xs',
				)}
			>
				{status}
			</b>
		{:else}
			<Status game={mlbGame} isSpoilerPrevented={false} />
		{/if}
	</div>

	<span
		class="grid min-h-rlh items-end text-center text-xs font-light *:col-span-full *:row-span-full *:line-clamp-1"
		style:grid-area="description"
	>
		{#if game.venueJa}
			<span class="text-current/50">{translateVenue(game.venueJa)}</span>
		{/if}
	</span>

	<div class="relative z-1" style:grid-area="boxscore">
		<TeamScores game={mlbGame} {boxscore} {linescore} />
	</div>

	{#if isFinal && decisions.length}
		<div
			class="flex flex-wrap justify-center gap-x-ch text-xs text-current/50"
			style:grid-area="pregame"
			lang="ja"
		>
			{#each decisions as [label, name] (label)}
				<span><span lang="en">{label}</span> {name}</span>
			{/each}
		</div>
	{:else if game.state === 'Preview' && (pitchers.away || pitchers.home)}
		<div class="z-1 grid grid-cols-2 backdrop-blur-xs" style:grid-area="pregame" lang="ja">
			<span class="line-clamp-1 pl-ch text-right break-all">{pitchers.away ?? ''}</span>
			<span class="line-clamp-1 pr-ch text-left break-all">{pitchers.home ?? ''}</span>
		</div>
	{/if}

	<div class="flex items-center justify-center gap-ch text-xs font-light" style:grid-area="link">
		<a
			class="inline-flex h-rlh items-center gap-[.5ch] text-current/50 hover-link group-not-hover/game:transition-[translate,opacity] hover:text-current md:group-not-hover/game:-translate-y-full md:group-not-hover/game:opacity-0"
			{href}
		>
			See details
			<ChevronRightIcon class="size-lh" />
		</a>
	</div>
</article>

<style>
	article {
		--status-size: 5ch;

		grid-template:
			'. description' auto
			'status boxscore' auto
			'. pregame' auto
			'. link' auto / var(--status-size) 1fr;
	}
</style>
