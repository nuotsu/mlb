<script lang="ts">
	import { formatDate } from '$lib/temporal'
	import ToggleFavorite from '$ui/favorites/toggle-favorite.svelte'

	let { game, feedLive }: { game: MLB.Game; feedLive: MLB.LiveGameFeed } = $props()

	const { gameInfo, weather } = $derived(feedLive.gameData)
</script>

<dl class="mx-auto description-list max-w-max px-ch">
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

	<dt>Favorite</dt>
	<dd>
		<ToggleFavorite
			target={{
				href: `/game/${game.gamePk}`,
				label: [
					feedLive.gameData.teams.away.abbreviation,
					feedLive.gameData.teams.home.abbreviation,
				].join(' @ '),
			}}
		/>
	</dd>
</dl>
