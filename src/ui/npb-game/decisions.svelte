<!--
	@component
	An NPB game's winning, losing and saving pitchers, laid out like the MLB game page's `Decision`.
-->
<script lang="ts">
	import {
		npbPlayerUrl,
		translateRecord,
		type NpbGame,
		type NpbGamePlayerName,
		type NpbLang,
	} from '#lib/npb-game.js'
	import { playerName } from './names.js'
	import NpbPhoto from './photo.svelte'

	let {
		game,
		names,
		lang,
	}: { game: NpbGame; names: Record<string, NpbGamePlayerName>; lang: NpbLang } = $props()

	const ja = $derived(lang === 'ja')

	const rows = $derived(
		(
			[
				['win', 'winner', ja ? '勝' : 'W'],
				['loss', 'loser', ja ? '敗' : 'L'],
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
		<h2 class="text-xs text-current/40">{ja ? '責任投手' : 'Decisions'}</h2>

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
							<NpbPhoto src={player.id ? names[player.id]?.photo : null} class="size-lh" />
						</div>

						{#if player.id}
							<a
								href={npbPlayerUrl(player.id)}
								target="_blank"
								rel="noopener noreferrer"
								class="line-clamp-1 min-w-[10ch] break-all decoration-dashed group-hover/decision:underline"
								title={playerName(player, names, lang, 'full')}
								lang={ja || !names[player.id] ? 'ja' : undefined}
							>
								{playerName(player, names, lang)}
								<span class="absolute inset-0"></span>
							</a>
						{:else}
							<span lang="ja">{player.nameJa}</span>
						{/if}
					</dt>

					{#if decision.recordJa}
						<dd class="leading-none tabular-nums" lang={ja ? 'ja' : undefined}>
							{ja ? decision.recordJa : translateRecord(decision.recordJa)}
						</dd>
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
