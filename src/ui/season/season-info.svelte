<script lang="ts">
	import { page } from '$app/state'
	import { formatDate } from '$lib/temporal'
	import Countdown from './countdown.svelte'

	const season = $derived(page.data.season as MLB.SeasonDateInfo)
</script>

<section class="space-y-lh px-ch text-center">
	<div class="flex flex-wrap justify-evenly gap-lh">
		<Countdown date={season.springStartDate} until="🌻 Spring Training" />
		<Countdown date="2026-03-04" until="🌎 World Baseball Classic" />
		<Countdown date={season.regularSeasonStartDate} until="🏟️ Opening Day" />
	</div>

	<article>
		<h2 class="text-xl">{season.seasonId} Season</h2>

		<table class="mx-auto">
			<tbody>
				<tr>
					<th>Spring Training</th>
					<td>
						{@render linkedDate(season.springStartDate)} - {@render linkedDate(
							season.springEndDate,
						)}
					</td>
				</tr>
				<tr>
					<th>Regular Season</th>
					<td>
						{@render linkedDate(season.regularSeasonStartDate)}
						-
						{@render linkedDate(season.regularSeasonEndDate)}
					</td>
				</tr>
				<tr>
					<th>All-Star Game</th>
					<td>{@render linkedDate(season.allStarDate, 'day')}</td>
				</tr>
				<tr>
					<th>Postseason</th>
					<td>
						{@render linkedDate(season.postSeasonStartDate)}
						-
						{@render linkedDate(season.postSeasonEndDate)}
					</td>
				</tr>
			</tbody>
		</table>
	</article>
</section>

{#snippet linkedDate(date: string = '', view: 'week' | 'day' = 'week')}
	<a class="decoration-dashed hover:underline" href="/schedule/{view}/{date}">
		{formatDate(date + 'T00:00:00', { weekday: 'short', month: 'short', day: 'numeric' })}
	</a>
{/snippet}

<style>
	th {
		font-weight: bold;
	}

	th,
	td {
		padding: 0 1ch;
	}
</style>
