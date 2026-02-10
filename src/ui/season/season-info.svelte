<script lang="ts">
	import { page } from '$app/state'
	import { formatDate } from '$lib/temporal'
	import Countdown from './countdown.svelte'

	const season = $derived(page.data.season as MLB.SeasonDateInfo)
</script>

<section class="space-y-lh px-ch py-lh">
	<div class="flex flex-wrap justify-center gap-x-[2lh] gap-y-lh">
		<Countdown date={season.springStartDate} until="🌻 Spring Training" />
		<Countdown date="2026-03-04" until="🌎 World Baseball Classic" />
		<Countdown date={season.regularSeasonStartDate} until="🏟️ Opening Day" />
	</div>

	<article class="space-y-ch">
		<h2 class="text-center h1">{season.seasonId} Season</h2>

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
</section>

{#snippet linkedDate(date: string = '', view: 'week' | 'day' = 'week')}
	<a class="decoration-dashed hover:underline" href="/schedule/{view}/{date}">
		{formatDate(date + 'T00:00:00', { weekday: 'short', month: 'numeric', day: 'numeric' })}
	</a>
{/snippet}
