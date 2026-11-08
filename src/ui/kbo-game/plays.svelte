<!--
	@component
	A KBO game's plays by half-inning, styled like the MLB game's: each batter's result in English,
	with koreabaseball.com's own shorthand on hover. There's no play-by-play to read them from, so
	they come from the box score's results by inning (see `kboPlays`), without the count, runners or
	runs on each play; the outs are counted from the results.
-->
<script lang="ts">
	import { toMlbTeam } from '#lib/kbo-game-mlb.js'
	import { kboNotation, translateResult, type KboGame } from '#lib/kbo-game.js'
	import { cn, ordinal } from '#lib/utils.js'
	import Empty from '#ui/empty.svelte'
	import BSO from '#ui/game/bso.svelte'
	import NpbPhoto from '#ui/npb-game/photo.svelte'
	import Logo from '#ui/team/logo.svelte'
	import Player from './player.svelte'

	let { game, class: className }: { game: KboGame; class?: string } = $props()

	const halves = $derived(
		(game.plays ?? []).map((half) => {
			let outs = 0
			return {
				...half,
				plays: half.plays.map((play) => {
					const notation = kboNotation(play.resultKo)
					const before = outs
					if (notation.kind === 'out' || (notation.kind === 'strikeout' && !notation.bases)) {
						outs = Math.min(
							3,
							outs + (notation.badge === 'DP' ? 2 : notation.badge === 'TP' ? 3 : 1),
						)
					}
					return { ...play, outs: before, homeRun: notation.kind === 'homeRun' }
				}),
			}
		}),
	)

	/** Runs scored in a half, from the linescore */
	function halfRuns(inning: number, half: 'top' | 'bottom') {
		return game.innings.find((i) => i.num === inning)?.[half === 'top' ? 'away' : 'home'] ?? 0
	}

	let container: HTMLDivElement | undefined = $state(undefined)
	const playCount = $derived(halves.reduce((n, half) => n + half.plays.length, 0))

	// A live game's latest play is at the bottom, so keep it in view as plays come in
	$effect(() => {
		if (container && playCount && game.state === 'Live') {
			container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' })
		}
	})
</script>

<div
	id="plays"
	class={cn(
		'group/plays mx-ch flex h-full max-h-[24lh] min-h-0 flex-col overflow-hidden border border-stroke text-sm',
		className,
	)}
>
	<fieldset class="flex shrink-0 flex-wrap gap-x-ch border-b border-stroke px-ch py-[.5ch]">
		<label>
			<input name="plays" type="radio" checked={game.state !== 'Final'} />
			All plays
		</label>

		<label>
			<input name="plays" value="scoring" type="radio" checked={game.state === 'Final'} />
			Scoring
		</label>
	</fieldset>

	{#if halves.length}
		<div class="min-h-[12lh] grow overflow-y-auto" bind:this={container}>
			{#each halves as half (`${half.inning}-${half.half}`)}
				{@const side = half.half === 'top' ? 'away' : 'home'}
				{@const team = toMlbTeam(game.teams[side].id, game.teams[side].nameKo)}
				{@const runs = halfRuns(half.inning, half.half)}
				<div
					data-has-scoring={runs ? '' : undefined}
					class="group-has-[[value='scoring']:checked]/plays:not-data-has-scoring:hidden"
				>
					<div
						class="sticky top-0 z-1 flex items-center gap-ch border-b border-stroke px-ch py-[.5ch] text-[10px] font-medium tracking-wide uppercase backdrop-blur-xs"
					>
						<Logo class="size-lh shrink-0" {team} />
						<span>{half.half === 'top' ? 'Top' : 'Bottom'} {ordinal(half.inning)}</span>
						{#if runs}
							<span class="ml-auto positive normal-case">
								{runs} run{runs === 1 ? '' : 's'}
							</span>
						{/if}
					</div>

					<ol class="px-ch">
						{#each half.plays as play, i (i)}
							<li
								class={cn(
									'flex anim-fade items-center gap-ch border-dashed border-stroke py-[.5ch] leading-tight [&+&]:border-t',
									play.homeRun && 'positive dark:text-accent',
								)}
							>
								<div class="shrink-0 py-[.5ch] text-[5px]">
									<BSO count={{ balls: 0, strikes: 0, outs: play.outs } as MLB.Count} hideLabels />
								</div>

								<NpbPhoto
									src={play.batter.id ? game.photos[play.batter.id] : null}
									class="size-rlh"
								/>

								<p class="grow">
									<strong class="font-medium"><Player player={play.batter} /></strong>
									<br />
									<span title={play.resultKo}>{translateResult(play.resultKo)}</span>
								</p>
							</li>
						{/each}
					</ol>
				</div>
			{/each}
		</div>
	{:else}
		<Empty class="grow p-ch">No plays</Empty>
	{/if}
</div>
