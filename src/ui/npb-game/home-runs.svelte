<!--
	@component
	An NPB game's home runs. npb.jp has no batted-ball data, so it's the list without the MLB
	game page's flight chart.
-->
<script lang="ts">
	import { toMlbTeam } from '#lib/npb-game-mlb.js'
	import {
		npbPlayerUrl,
		type NpbGame,
		type NpbGamePlayerName,
		type NpbLang,
		type NpbPlayerRef,
	} from '#lib/npb-game.js'
	import { cn, ordinal } from '#lib/utils.js'
	import Logo from '#ui/team/logo.svelte'
	import { playerName } from './names.js'
	import NpbPhoto from './photo.svelte'

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

	const RUNNERS = {
		en: ['solo', '2-run', '3-run', 'grand slam'],
		ja: ['ソロ', '2ラン', '3ラン', '満塁'],
	}
</script>

{#snippet player(ref: NpbPlayerRef)}
	{#if ref.id}
		<a
			class="decoration-dashed hover:underline"
			href={npbPlayerUrl(ref.id)}
			target="_blank"
			rel="noopener noreferrer"
			title={playerName(ref, names, lang, 'full')}
			lang={ja || !names[ref.id] ? 'ja' : undefined}>{playerName(ref, names, lang)}</a
		>
	{:else}
		<span lang="ja">{ref.nameJa}</span>
	{/if}
{/snippet}

{#if game.homeRuns.length}
	<article id="home-runs" class={cn('space-y-ch', className)}>
		<h2 class="text-xs text-current/40">{ja ? '本塁打' : 'Home Runs'}</h2>

		<ul class="grid gap-[.5ch]">
			{#each game.homeRuns as hr, i (i)}
				<li class="flex items-center gap-ch">
					<Logo class="size-lh shrink-0" team={toMlbTeam(game.teams[hr.side], lang)} />
					<NpbPhoto src={hr.batter.id ? names[hr.batter.id]?.photo : null} class="size-lh" />
					<span>
						{@render player(hr.batter)}
						<span class="tabular-nums">({hr.number})</span>
						<span class="text-sm text-current/50">
							{ja ? `${hr.inning}回` : `${ordinal(hr.inning)},`}
							{RUNNERS[lang][hr.runnersOn]}
							{#if hr.pitcher.nameJa}
								{ja ? '' : 'off'}
								{@render player(hr.pitcher)}
							{/if}
						</span>
					</span>
				</li>
			{/each}
		</ul>
	</article>
{/if}
