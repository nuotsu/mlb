<!--
	@component
	A KBO game's winning, losing and saving pitchers, laid out like the MLB game page's `Decision`.
-->
<script lang="ts">
	import type { KboGame } from '#lib/kbo-game.js'
	import NpbPhoto from '#ui/npb-game/photo.svelte'
	import Player from './player.svelte'

	let { game }: { game: KboGame } = $props()

	const rows = $derived(
		(
			[
				['win', 'winner', 'W'],
				['loss', 'loser', 'L'],
				['save', 'save', 'S'],
			] as const
		).flatMap(([key, title, letter]) => {
			const decision = game.decisions[key]
			return decision ? [{ decision, title, letter }] : []
		}),
	)
</script>

{#if rows.length}
	<article class="max-w-max space-y-ch">
		<h2 class="text-xs text-current/40">Decisions</h2>

		<dl class="grid gap-[.5ch]">
			{#each rows as { decision, title, letter } (title)}
				{@const { player } = decision}
				<div class="group/decision relative flex items-center gap-ch">
					<dt class="flex shrink-0 items-center gap-ch self-start">
						<div class="relative flex items-center gap-ch">
							<abbr
								class="absolute bottom-0 left-0 z-1 grid aspect-square w-lh place-content-center text-[6px] font-bold text-white"
								{title}
							>
								{letter}
							</abbr>
							<NpbPhoto src={player.id ? game.photos[player.id] : null} class="size-lh" />
						</div>

						<Player
							{player}
							pitcher
							class="line-clamp-1 min-w-[10ch] break-all group-hover/decision:underline"
						/>
					</dt>

					{#if decision.record}
						<dd class="leading-none tabular-nums">{decision.record}</dd>
					{/if}
				</div>
			{/each}
		</dl>
	</article>
{/if}

<style>
	abbr {
		&[title='winner'] {
			background-color: var(--color-green-600);
		}
		&[title='loser'] {
			background-color: var(--color-red-600);
		}
		&[title='save'] {
			background-color: var(--color-blue-600);
		}
	}
</style>
