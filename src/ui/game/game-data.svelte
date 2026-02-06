<script lang="ts">
	import { formatDate } from '$lib/temporal'

	let { game, feedLive }: { game: MLB.Game; feedLive: MLB.LiveGameFeed } = $props()

	const { gameInfo, weather } = $derived(feedLive.gameData)
</script>

<dl class="mx-auto grid max-w-max grid-cols-[auto_1fr] gap-x-lh px-ch [&_dt]:text-current/50">
	<dt>Date</dt>
	<dd>
		<a class="link" href="/schedule/day/{formatDate(game.gameDate, { locale: 'en-CA' })}">
			{formatDate(game.gameDate, {
				month: 'long',
				day: 'numeric',
				year: 'numeric',
			})}
			({formatDate(game.gameDate, {
				weekday: 'long',
			})})
		</a>
	</dd>

	{#if game.description}
		<dt>Description</dt>
		<dd>{game.description}</dd>
	{/if}

	{#if game.seriesGameNumber && game.gamesInSeries}
		<dt>Series</dt>
		<dd>{game.seriesGameNumber} of {game.gamesInSeries}</dd>
	{/if}

	<dt>Home team</dt>
	<dd><a class="link" href="/teams/{game.teams.home.team.id}">{game.teams.home.team.name}</a></dd>

	<dt>Away team</dt>
	<dd><a class="link" href="/teams/{game.teams.away.team.id}">{game.teams.away.team.name}</a></dd>

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
		{@const { condition, temp, wind } = weather ?? {}}
		<dt>Weather</dt>
		<dd>
			{[condition, temp && `${temp}°F`, wind && `Wind: ${wind} mph`].filter(Boolean).join(' / ')}
		</dd>
	{/if}
</dl>
