<script lang="ts">
	import { formatDate } from '$lib/temporal'

	let { game, feedLive }: { game: MLB.Game; feedLive: MLB.LiveGameFeed } = $props()

	const { gameInfo, weather } = $derived(feedLive.gameData)
</script>

<dl class="grid grid-cols-[auto_1fr] gap-x-lh">
	<dt>Date</dt>
	<dd>{formatDate(game.gameDate, { year: 'numeric', month: 'long', day: 'numeric' })}</dd>

	{#if game.description}
		<dt>Description</dt>
		<dd>{game.description}</dd>
	{/if}

	<dt>Series</dt>
	<dd>{game.seriesGameNumber} of {game.gamesInSeries}</dd>

	<dt>Venue</dt>
	<dd>{game.venue.name}</dd>

	{#if gameInfo?.attendance}
		<dt>Attendance</dt>
		<dd>{gameInfo?.attendance?.toLocaleString()}</dd>
	{/if}

	{#if gameInfo?.gameDurationMinutes}
		{@const duration = gameInfo?.gameDurationMinutes ?? 0}
		{@const hours = Math.floor(duration / 60)}
		{@const remainingMinutes = duration % 60}
		<dt>Duration</dt>
		<dd>{hours}h {remainingMinutes}m</dd>
	{/if}

	{#if weather?.condition}
		<dt>Weather</dt>
		<dd>
			{[`${weather?.condition}`, `${weather?.temp}°F`, `${feedLive.gameData.weather?.wind} mph`]
				.filter(Boolean)
				.join(' / ')}
		</dd>
	{/if}

	<dt>Endpoint</dt>
	<dd>
		<a href="https://statsapi.mlb.com{game.link}">Official</a> |
		<a href={game.link}>Playground</a>
	</dd>
</dl>

<style>
	dl a {
		text-decoration: underline dashed;

		&:hover {
			text-decoration-style: solid;
		}
	}
</style>
