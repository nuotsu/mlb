<!--
	@component
	An NPB game's scoreboard for the page header: status, team scores and linescore, laid out like
	the MLB game card and built from the same components.
-->
<script lang="ts">
	import { toMlbGame, toMlbLinescore, toMlbTeam } from '#lib/npb-game-mlb.js'
	import type { NpbGame, NpbLang } from '#lib/npb-game.js'
	import { translateStatus } from '#lib/npb-game.js'
	import { cn } from '#lib/utils.js'
	import Inning from '#ui/game/inning.svelte'
	import Linescore from '#ui/game/linescore.svelte'
	import TeamScores from '#ui/game/team-scores.svelte'

	let { game, lang, class: className }: { game: NpbGame; lang: NpbLang; class?: string } = $props()

	const mlbGame = $derived(toMlbGame(game, lang))
	const linescore = $derived(toMlbLinescore(game))
	const boxscore = $derived({
		teams: {
			away: { team: toMlbTeam(game.teams.away, lang) },
			home: { team: toMlbTeam(game.teams.home, lang) },
		},
	} as unknown as MLB.Boxscore)

	const isLive = $derived(game.state === 'Live')
	const isFinal = $derived(game.state === 'Final' && !game.isCancelled)

	const status = $derived.by(() => {
		if (!game.statusJa) return game.startTime ?? ''
		if (lang === 'ja') return game.statusJa
		const text = translateStatus(game.statusJa)
		const innings = linescore.innings?.length ?? 0
		return innings > 9 && text === 'Final' ? `Final/${innings}` : text
	})

	const statusLines = $derived(
		lang === 'ja' ? (status.match(/^(試合)(.+)$/)?.slice(1) ?? [status]) : [status],
	)
</script>

<article
	id="scoreboard"
	class={cn('group/game @container/game isolate grid items-end', className)}
	data-state={game.state}
>
	<div
		class="relative z-1 m-auto grid w-full text-center *:leading-none group-has-[[style*=linescore]]/game:h-12"
		style:grid-area="status"
	>
		{#if isLive && game.currentInning}
			<Inning {linescore} />
		{:else}
			<b
				class={cn(
					'absolute inset-x-0 top-1/2 -translate-y-1/2 px-[.5ch]',
					statusLines.some((line) => line.length > 6) ? 'text-[x-small]' : 'text-xs',
				)}
				lang={lang === 'ja' && game.statusJa ? 'ja' : undefined}
			>
				<!-- Japanese breaks between words, not wherever it runs out of room: 試合 / 終了 -->
				{#each statusLines as line, i (i)}
					<span class="block">{line}</span>
				{/each}
			</b>
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
