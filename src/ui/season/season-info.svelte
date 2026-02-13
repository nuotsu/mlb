<script lang="ts">
	import { formatDate } from '$lib/temporal'

	let { season }: { season: MLB.SeasonDateInfo } = $props()
</script>

<article class="space-y-ch">
	<h2 class="text-center h1">{season.seasonId} Season Schedule</h2>

	<dl class="mx-auto description-list max-w-max tabular-nums">
		<dt>Spring Training</dt>
		<dd>
			{@render linkedDate(season.springStartDate)} - {@render linkedDate(season.springEndDate)}
		</dd>

		<dt>Regular Season</dt>
		<dd>
			{@render linkedDate(season.regularSeasonStartDate)}
			-
			{@render linkedDate(season.regularSeasonEndDate)}
		</dd>

		<dt>All-Star Game</dt>
		<dd>{@render linkedDate(season.allStarDate, 'day')}</dd>

		<dt>Postseason</dt>
		<dd>
			{@render linkedDate(season.postSeasonStartDate)}
			-
			{@render linkedDate(season.postSeasonEndDate)}
		</dd>
	</dl>
</article>

{#snippet linkedDate(date: string = '', view: 'week' | 'day' = 'week')}
	<a class="hover-link" href="/schedule/{view}/{date}">
		{formatDate(date + 'T00:00:00', { weekday: 'short', month: 'numeric', day: 'numeric' })}
	</a>
{/snippet}
