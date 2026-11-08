<!--
	@component
	A KBO game's details, laid out like the MLB game page's `GameData`, then the box score's notes
	(game-winning RBI, doubles, errors, steals and so on) with their labels in English.
-->
<script lang="ts">
	import { kboGameDate } from '#lib/kbo-game-mlb.js'
	import {
		translateCompetition,
		translateNote,
		translateNoteLabel,
		translateVenue,
		type KboGame,
	} from '#lib/kbo-game.js'
	import { KBO_SPORT_ID } from '#lib/kbo.js'
	import { formatDate } from '#lib/temporal.js'
	import type { HTMLAttributes } from 'svelte/elements'

	let {
		game,
		class: className,
	}: {
		game: KboGame
	} & HTMLAttributes<HTMLDListElement> = $props()

	const gameDate = $derived(kboGameDate(game))

	/** Korea time, where the game is played, rather than the viewer's */
	const timeZone = 'Asia/Seoul'
	const at = (time: string) =>
		`${formatDate(`${game.date}T${time}:00+09:00`, { timeZone, hour: 'numeric', minute: '2-digit' })} KST`

	/** Shown elsewhere on the page: home runs in their own list, umpires in theirs */
	const notes = $derived(game.box?.notes.filter((note) => !['홈런', '심판'].includes(note.labelKo)))
</script>

<dl class="description-list max-w-max {className}">
	<dt>Date</dt>
	<dd>
		<a class="link" href="/schedule/day/{game.date}?sportId={KBO_SPORT_ID}">
			{formatDate(gameDate, { timeZone, month: 'long', day: 'numeric', year: 'numeric' })}
			({formatDate(gameDate, { timeZone, weekday: 'short' })})
		</a>
		{#if game.startTime}
			@ {at(game.startTime)}
		{/if}
	</dd>

	<dt>League</dt>
	<dd>{translateCompetition(game.competition)}</dd>

	{#if game.gameNumber && game.competition !== 'all-star'}
		<dt>Series</dt>
		<dd>
			{game.competition === 'regular'
				? `Game ${game.gameNumber} of the season`
				: `Game ${game.gameNumber}`}
		</dd>
	{/if}

	{#if game.venueKo}
		<dt>Venue</dt>
		<dd>{translateVenue(game.venueKo)}</dd>
	{/if}

	{#if game.attendance}
		<dt>Attendance</dt>
		<dd>{game.attendance.toLocaleString('en-US')}</dd>
	{/if}

	{#if game.startTime && game.state !== 'Preview' && !game.isCancelled}
		<dt>First Pitch</dt>
		<dd>{at(game.startTime)}</dd>
	{/if}

	{#if game.duration}
		<dt>Duration</dt>
		<dd>{Math.floor(game.duration / 60)}h {game.duration % 60}m</dd>
	{/if}

	{#if game.tv}
		<dt>TV</dt>
		<dd>{game.tv.split(',').join(', ')}</dd>
	{/if}

	{#each notes ?? [] as note (note.labelKo)}
		<dt>{translateNoteLabel(note.labelKo)}</dt>
		<dd lang="ko">{translateNote(note.textKo)}</dd>
	{/each}
</dl>
