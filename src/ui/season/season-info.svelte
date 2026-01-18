<script lang="ts">
	import { page } from '$app/state'
	import { formatDate } from '$lib/temporal'
	import Countdown from './countdown.svelte'

	const season = $derived(page.data.season as MLB.SeasonResponse)
	const current = $derived(season.seasons[0])
</script>

<section class="space-y-lh text-center">
	<div class="flex flex-wrap justify-evenly gap-lh">
		<Countdown date={current.springStartDate} until="Spring Training" />
		<Countdown date={current.regularSeasonStartDate} until="Opening Day" />
	</div>

	{#each season.seasons as s}
		<article>
			<h1>{s.seasonId} Season</h1>

			<table class="mx-auto">
				<tbody>
					<tr>
						<th>Spring Training</th>
						<td>{@render linkedDate(s.springStartDate)} - {@render linkedDate(s.springEndDate)}</td>
					</tr>
					<tr>
						<th>Regular Season</th>
						<td>
							{@render linkedDate(s.regularSeasonStartDate)}
							-
							{@render linkedDate(s.regularSeasonEndDate)}
						</td>
					</tr>
					<tr>
						<th>All-Star Game</th>
						<td>{@render linkedDate(s.allStarDate)}</td>
					</tr>
					<tr>
						<th>Postseason</th>
						<td>
							{@render linkedDate(s.postSeasonStartDate)}
							-
							{@render linkedDate(s.postSeasonEndDate)}
						</td>
					</tr>
				</tbody>
			</table>
		</article>
	{/each}
</section>

{#snippet linkedDate(date: string = '')}
	<a class="decoration-dashed hover:underline" href={`/schedule/${date}`}>
		{formatDate(date + 'T00:00:00', { weekday: 'short', month: 'short', day: 'numeric' })}
	</a>
{/snippet}

<style>
	th,
	td {
		padding: 0 1ch;
	}
</style>
