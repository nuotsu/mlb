<!--
	@component
	A KBO game's home runs, from the box score's notes. koreabaseball.com has no batted-ball data,
	so it's the list without the MLB game page's flight chart.
-->
<script lang="ts">
	import { toMlbTeam } from '#lib/kbo-game-mlb.js'
	import type { KboGame } from '#lib/kbo-game.js'
	import { cn, ordinal } from '#lib/utils.js'
	import NpbPhoto from '#ui/npb-game/photo.svelte'
	import Logo from '#ui/team/logo.svelte'
	import Player from './player.svelte'

	let { game, class: className }: { game: KboGame; class?: string } = $props()

	const RUNNERS = ['solo', '2-run', '3-run', 'grand slam']

	/** The batter's ID from the side's box score, which has it from the team's register */
	function batterId(side: 'away' | 'home', nameKo: string) {
		return game.box?.teams[side].batters.find((line) => line.player.nameKo === nameKo)?.player.id
	}
</script>

{#if game.homeRuns.length}
	<article id="home-runs" class={cn('space-y-ch', className)}>
		<h2 class="text-xs text-current/40">Home Runs</h2>

		<ul class="grid gap-[.5ch]">
			{#each game.homeRuns as hr, i (i)}
				{@const id = batterId(hr.side, hr.batter.nameKo) ?? null}
				<li class="flex items-center gap-ch">
					<Logo
						class="size-lh shrink-0"
						team={toMlbTeam(game.teams[hr.side].id, game.teams[hr.side].nameKo)}
					/>
					<NpbPhoto src={id ? game.photos[id] : null} class="size-lh" />
					<span>
						<Player player={{ ...hr.batter, id }} />
						<span class="tabular-nums">({hr.number})</span>
						<span class="text-sm text-current/50">
							{ordinal(hr.inning)},
							{RUNNERS[hr.runs - 1] ?? `${hr.runs}-run`}
							{#if hr.pitcher}
								off <Player player={hr.pitcher} pitcher />
							{/if}
						</span>
					</span>
				</li>
			{/each}
		</ul>
	</article>
{/if}
