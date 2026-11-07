<!--
	@component
	An NPB game's details: when and where, decisions, home runs and the umpires.
-->
<script lang="ts">
	import { toMlbTeam } from '#lib/npb-game-mlb.js'
	import {
		npbPlayerUrl,
		translateCompetition,
		translateRecord,
		translateVenue,
		umpireTitle,
		type NpbDecision,
		type NpbGame,
		type NpbLang,
		type NpbPlayerRef,
	} from '#lib/npb-game.js'
	import type { NpbGamePlayerName } from '#lib/npb-game.js'
	import { cn, ordinal } from '#lib/utils.js'
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

	const date = $derived(
		new Date(`${game.date}T12:00:00+09:00`).toLocaleDateString(ja ? 'ja-JP' : 'en-US', {
			timeZone: 'Asia/Tokyo',
			weekday: 'short',
			year: 'numeric',
			month: 'short',
			day: 'numeric',
		}),
	)

	const duration = $derived(
		game.duration == null
			? null
			: ja
				? `${Math.floor(game.duration / 60)}時間${game.duration % 60}分`
				: `${Math.floor(game.duration / 60)}:${String(game.duration % 60).padStart(2, '0')}`,
	)

	const decisions = $derived(
		(
			[
				['win', ja ? '勝' : 'W', 'Winning pitcher'],
				['loss', ja ? '敗' : 'L', 'Losing pitcher'],
				['save', 'S', 'Save'],
			] as const
		).flatMap(([key, abbr, title]) => {
			const decision = game.decisions[key]
			return decision ? [{ decision, abbr, title }] : []
		}),
	)

	const UMPIRES_JA = {
		HP: '球審',
		'1B': '一塁',
		'2B': '二塁',
		'3B': '三塁',
		LF: '左翼',
		RF: '右翼',
	}

	function runnersLabel(runnersOn: number) {
		if (ja) return ['ソロ', '2ラン', '3ラン', '満塁'][runnersOn]
		return ['solo', '2-run', '3-run', 'grand slam'][runnersOn]
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

{#snippet decisionRow({
	decision,
	abbr,
	title,
}: {
	decision: NpbDecision
	abbr: string
	title: string
})}
	<div class="flex items-center gap-ch">
		<dt>
			<abbr class="inline-block w-[2ch] text-xs text-current/40 no-underline" {title}>{abbr}</abbr>
		</dt>
		<dd class="flex gap-ch">
			{@render player(decision.player)}
			{#if decision.recordJa}
				<span class="text-current/50 tabular-nums">
					{ja ? decision.recordJa : translateRecord(decision.recordJa)}
				</span>
			{/if}
		</dd>
	</div>
{/snippet}

<div
	id="game-info"
	class={cn('flex flex-wrap items-start justify-evenly gap-lh px-[2ch] *:min-w-[24ch]', className)}
>
	<article class="space-y-ch">
		<h2 class="text-xs text-current/40">{ja ? '試合情報' : 'Game info'}</h2>

		<dl class="grid grid-cols-[auto_1fr] gap-x-ch gap-y-[.25ch] text-sm">
			<dt class="text-current/50">{ja ? '日付' : 'Date'}</dt>
			<dd>{date}</dd>

			{#if game.venueJa}
				<dt class="text-current/50">{ja ? '球場' : 'Venue'}</dt>
				<dd lang={ja ? 'ja' : undefined}>{ja ? game.venueJa : translateVenue(game.venueJa)}</dd>
			{/if}

			{#if game.competitionJa}
				<dt class="text-current/50">{ja ? '大会' : 'League'}</dt>
				<dd lang={ja ? 'ja' : undefined}>
					{ja ? game.competitionJa : translateCompetition(game.competitionJa)}
					{#if game.seriesGameNumber}
						<span class="text-current/50">
							{ja
								? `${game.seriesGameNumber}回戦`
								: `(game ${game.seriesGameNumber} of the season series)`}
						</span>
					{/if}
				</dd>
			{/if}

			{#if game.startTime}
				<dt class="text-current/50">{ja ? '開始' : 'First pitch'}</dt>
				<dd class="tabular-nums">
					{game.startTime}
					{#if game.endTime}–{game.endTime}{/if}
					<span class="text-current/50">{ja ? '' : 'JST'}</span>
				</dd>
			{/if}

			{#if duration}
				<dt class="text-current/50">{ja ? '試合時間' : 'Time'}</dt>
				<dd class="tabular-nums">{duration}</dd>
			{/if}

			{#if game.attendance}
				<dt class="text-current/50">{ja ? '入場者' : 'Attendance'}</dt>
				<dd class="tabular-nums">
					{game.attendance.toLocaleString(ja ? 'ja-JP' : 'en-US')}{ja ? '人' : ''}
				</dd>
			{/if}
		</dl>
	</article>

	{#if decisions.length}
		<article class="space-y-ch">
			<h2 class="text-xs text-current/40">{ja ? '責任投手' : 'Decisions'}</h2>
			<dl class="grid gap-[.5ch] text-sm">
				{#each decisions as row (row.abbr)}
					{@render decisionRow(row)}
				{/each}
			</dl>
		</article>
	{/if}

	{#if game.homeRuns.length}
		<article id="home-runs" class="space-y-ch">
			<h2 class="text-xs text-current/40">{ja ? '本塁打' : 'Home runs'}</h2>
			<ul class="grid gap-[.5ch] text-sm">
				{#each game.homeRuns as hr, i (i)}
					<li class="flex items-center gap-ch">
						<Logo class="size-lh shrink-0" team={toMlbTeam(game.teams[hr.side], lang)} />
						<span>
							{@render player(hr.batter)}
							<span class="tabular-nums">({hr.number})</span>
							<span class="text-current/50">
								{#if ja}
									{hr.inning}回{runnersLabel(hr.runnersOn)}
								{:else}
									{ordinal(hr.inning)} inning, {runnersLabel(hr.runnersOn)}
								{/if}
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

	{#if game.umpires.length}
		<article id="umpires" class="space-y-ch">
			<h2 class="text-xs text-current/40">{ja ? '審判' : 'Umpires'}</h2>
			<ul class="grid gap-[.25ch] text-sm">
				{#each game.umpires as umpire (umpire.position)}
					<li class="flex items-center gap-ch">
						<abbr
							class="w-[2ch] shrink-0 text-xs text-current/40 no-underline"
							title={umpireTitle(umpire.position)}
						>
							{ja ? UMPIRES_JA[umpire.position] : umpire.position}
						</abbr>
						<span lang="ja">{umpire.nameJa}</span>
					</li>
				{/each}
			</ul>
		</article>
	{/if}
</div>
