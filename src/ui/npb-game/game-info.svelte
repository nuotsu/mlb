<!--
	@component
	An NPB game's details, laid out like the MLB game page's `GameData`.
-->
<script lang="ts">
	import { npbGameDate } from '#lib/npb-game-mlb.js'
	import {
		translateCompetition,
		translateVenue,
		type NpbGame,
		type NpbLang,
	} from '#lib/npb-game.js'
	import { formatDate } from '#lib/temporal.js'
	import type { HTMLAttributes } from 'svelte/elements'

	let {
		game,
		lang,
		class: className,
	}: {
		game: NpbGame
		lang: NpbLang
	} & HTMLAttributes<HTMLDListElement> = $props()

	const ja = $derived(lang === 'ja')
	const locale = $derived(ja ? 'ja-JP' : 'en-US')
	const gameDate = $derived(npbGameDate(game))

	/** Japan time, where the game is played, rather than the viewer's */
	const timeZone = 'Asia/Tokyo'
	const time = $derived(
		`${formatDate(gameDate, { locale, timeZone, hour: 'numeric', minute: '2-digit' })}${ja ? '' : ' JST'}`,
	)
</script>

<dl class="description-list max-w-max {className}">
	<dt>{ja ? '日付' : 'Date'}</dt>
	<dd>
		{formatDate(gameDate, { locale, timeZone, month: 'long', day: 'numeric', year: 'numeric' })}
		({formatDate(gameDate, { locale, timeZone, weekday: 'short' })})
		{#if game.startTime}
			@ {time}
		{/if}
	</dd>

	{#if game.competitionJa}
		<dt>{ja ? '大会' : 'League'}</dt>
		<dd lang={ja ? 'ja' : undefined}>
			{ja ? game.competitionJa : translateCompetition(game.competitionJa)}
		</dd>
	{/if}

	{#if game.seriesGameNumber}
		<dt>{ja ? '対戦' : 'Series'}</dt>
		<dd>{ja ? `${game.seriesGameNumber}回戦` : `Game ${game.seriesGameNumber} of the season`}</dd>
	{/if}

	{#if game.venueJa}
		<dt>{ja ? '球場' : 'Venue'}</dt>
		<dd lang={ja ? 'ja' : undefined}>{ja ? game.venueJa : translateVenue(game.venueJa)}</dd>
	{/if}

	{#if game.attendance}
		<dt>{ja ? '入場者' : 'Attendance'}</dt>
		<dd>{game.attendance.toLocaleString(locale)}{ja ? '人' : ''}</dd>
	{/if}

	{#if game.startTime && game.state !== 'Preview'}
		<dt>{ja ? '開始' : 'First Pitch'}</dt>
		<dd>{time}</dd>
	{/if}

	{#if game.duration}
		{@const hours = Math.floor(game.duration / 60)}
		{@const minutes = game.duration % 60}
		<dt>{ja ? '試合時間' : 'Duration'}</dt>
		<dd>{ja ? `${hours}時間${minutes}分` : `${hours}h ${minutes}m`}</dd>
	{/if}
</dl>
