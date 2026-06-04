<script lang="ts">
	import { formatDate } from '$lib/temporal'
	import type { HTMLAttributes } from 'svelte/elements'

	let {
		game,
		feedLive,
		seriesRecord,
		class: className,
	}: {
		game: MLB.Game
		feedLive: MLB.LiveGameFeed
		seriesRecord?: { homeWins: number; awayWins: number } | null
	} & HTMLAttributes<HTMLDListElement> = $props()

	const { gameInfo, weather } = $derived(feedLive.gameData)
</script>

<dl class="description-list max-w-max {className}">
	<dt>Date</dt>
	<dd>
		<a class="link" href="/schedule/day/{formatDate(game.gameDate, { locale: 'en-CA' })}">
			{formatDate(game.gameDate, {
				month: 'long',
				day: 'numeric',
				year: 'numeric',
			})}
			({formatDate(game.gameDate, {
				weekday: 'short',
			})})
		</a>
		@ {formatDate(game.gameDate, { hour: 'numeric', minute: '2-digit' })}
	</dd>

	{#if game.description}
		<dt>Description</dt>
		<dd>{game.description}</dd>
	{/if}

	{#if game.seriesGameNumber && game.gamesInSeries}
		<dt>Series</dt>
		<dd>
			{game.seriesGameNumber} of {game.gamesInSeries}
			{#if seriesRecord && seriesRecord.homeWins + seriesRecord.awayWins > 0}
				(Home {seriesRecord.homeWins}-{seriesRecord.awayWins})
			{/if}
		</dd>
	{/if}

	<dt>Venue</dt>
	<dd>{game.venue.name}</dd>

	{#if gameInfo?.attendance}
		<dt>Attendance</dt>
		<dd>{gameInfo?.attendance?.toLocaleString()}</dd>
	{/if}

	{#if gameInfo?.firstPitch}
		<dt>First Pitch</dt>
		<dd>{formatDate(gameInfo?.firstPitch, { hour: 'numeric', minute: '2-digit' })}</dd>
	{/if}

	{#if gameInfo?.gameDurationMinutes}
		{@const duration = gameInfo?.gameDurationMinutes ?? 0}
		{@const hours = Math.floor(duration / 60)}
		{@const remainingMinutes = duration % 60}
		<dt>Duration</dt>
		<dd>{hours}h {remainingMinutes}m</dd>
	{/if}

	{#if weather?.condition}
		{@const { condition, temp, wind } = weather ?? {}}
		<dt>Weather</dt>
		<dd>
			{[condition, temp && `${temp}°F`, wind && `Wind: ${wind} mph`].filter(Boolean).join(' / ')}
		</dd>
	{/if}
</dl>
