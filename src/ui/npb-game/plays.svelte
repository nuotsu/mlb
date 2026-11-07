<!--
	@component
	An NPB game's play-by-play by half-inning, styled like the MLB game's plays: runners on base,
	the count before the last pitch and the outs, then the result. npb.jp has no pitch data.
-->
<script lang="ts">
	import { toMlbTeam } from '#lib/npb-game-mlb.js'
	import { translatePlay, type NpbGame, type NpbLang, type NpbPlayEvent } from '#lib/npb-game.js'
	import type { NpbGamePlayerName } from '#lib/npb-game.js'
	import { cn, ordinal } from '#lib/utils.js'
	import Empty from '#ui/empty.svelte'
	import BaseRunners from '#ui/game/base-runners.svelte'
	import BSO from '#ui/game/bso.svelte'
	import Logo from '#ui/team/logo.svelte'
	import { playerName } from './names.js'

	let {
		game,
		names,
		lang,
		class: className,
	}: {
		game: NpbGame
		names: Record<string, NpbGamePlayerName>
		lang: NpbLang
		class?: string
	} = $props()

	const ja = $derived(lang === 'ja')
	const nameOf = (player: Parameters<typeof playerName>[0]) => playerName(player, names, lang)

	const halves = $derived(game.plays ?? [])

	function label(inning: number, half: 'top' | 'bottom') {
		return ja
			? `${inning}回${half === 'top' ? '表' : '裏'}`
			: `${half === 'top' ? 'Top' : 'Bottom'} ${ordinal(inning)}`
	}

	function description(event: NpbPlayEvent) {
		const text = event.type === 'atBat' ? event.resultJa : event.textJa
		if (ja) return text
		return translatePlay(text, nameOf, event.type === 'note' ? event.players : [])
	}

	/** Runs scored in a half, from the linescore */
	function halfRuns(inning: number, half: 'top' | 'bottom') {
		const runs = game.innings.find((i) => i.num === inning)?.[half === 'top' ? 'away' : 'home']
		return typeof runs === 'number' ? runs : 0
	}

	let container: HTMLDivElement | undefined = $state(undefined)
	const eventCount = $derived(halves.reduce((n, half) => n + half.events.length, 0))

	// A live game's latest play is at the bottom, so keep it in view as plays come in
	$effect(() => {
		if (container && eventCount && game.state === 'Live') {
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
			{ja ? 'すべて' : 'All plays'}
		</label>

		<label>
			<input name="plays" value="scoring" type="radio" checked={game.state === 'Final'} />
			{ja ? '得点' : 'Scoring'}
		</label>
	</fieldset>

	{#if halves.length}
		<div class="min-h-[12lh] grow overflow-y-auto" bind:this={container}>
			{#each halves as half (`${half.inning}-${half.half}`)}
				{@const team = toMlbTeam(game.teams[half.half === 'top' ? 'away' : 'home'], lang)}
				{@const runs = halfRuns(half.inning, half.half)}
				<div
					data-has-scoring={runs ? '' : undefined}
					class="group-has-[[value='scoring']:checked]/plays:not-data-has-scoring:hidden"
				>
					<div
						class="sticky top-0 z-1 flex items-center gap-ch border-b border-stroke px-ch py-[.5ch] text-[10px] font-medium tracking-wide uppercase backdrop-blur-xs"
					>
						<Logo class="size-lh shrink-0" {team} />
						<span>{label(half.inning, half.half)}</span>
						{#if runs}
							<span class="ml-auto positive normal-case">
								{ja ? `${runs}点` : `${runs} run${runs === 1 ? '' : 's'}`}
							</span>
						{/if}
					</div>

					<ol class="px-ch">
						{#each half.events as event, i (i)}
							{@const scoring = event.type === 'atBat' && event.rbi > 0}
							<li
								class={cn(
									'flex anim-fade items-center gap-ch border-dashed border-stroke py-[.5ch] leading-tight [&+&]:border-t',
									'group-has-[[value=scoring]:checked]/plays:not-data-scoring:hidden',
									scoring && 'positive dark:text-accent',
									event.type === 'note' && 'text-xs text-current/60',
								)}
								data-scoring={scoring ? '' : undefined}
							>
								{#if event.type === 'atBat'}
									{@const photo = event.batter.id ? names[event.batter.id]?.photo : null}
									<div class="shrink-0 py-[.5ch] text-[5px]">
										<BaseRunners runnerIndex={event.runners} />
										<BSO
											count={{
												balls: event.count?.balls ?? 0,
												strikes: event.count?.strikes ?? 0,
												outs: event.outs,
											} as MLB.Count}
											hideLabels
										/>
									</div>

									{#if photo}
										<img
											class="img-fade size-rlh shrink-0 rounded-full bg-foreground/10 object-cover object-top opacity-0 transition-opacity"
											src={photo}
											width="144"
											height="180"
											alt=""
											loading="lazy"
											decoding="async"
											onload={(e) => e.currentTarget.classList.remove('opacity-0')}
										/>
									{/if}

									<p class="grow">
										<strong class="font-medium" lang={ja ? 'ja' : undefined}>
											{nameOf(event.batter)}
										</strong>
										<span class="text-current/60 tabular-nums">
											{#if event.count}({event.count.balls}-{event.count.strikes}){/if}
										</span>
										<br />
										<span lang={ja ? 'ja' : undefined}>{description(event)}</span>
									</p>
								{:else}
									<p class="grow" lang={ja ? 'ja' : undefined}>{description(event)}</p>
								{/if}
							</li>
						{/each}
					</ol>
				</div>
			{/each}
		</div>
	{:else}
		<Empty class="grow p-ch">{ja ? 'まだプレーはありません' : 'No plays'}</Empty>
	{/if}
</div>
