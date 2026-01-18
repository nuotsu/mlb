<script lang="ts">
	import { page } from '$app/state'
	import { formatDate } from '$lib/temporal'

	const season = $derived(page.data.season as MLB.SeasonResponse)

	$inspect(season)

	function format(date?: string) {
		if (!date) return 'N/A'
		return formatDate(date, { weekday: 'short', month: 'short', day: 'numeric' })
	}
</script>

{#each season.seasons as s}
	<article>
		<h1 class="text-center">{s.seasonId} Season</h1>

		<table class="mx-auto">
			<tbody>
				<tr>
					<th>Spring Training</th>
					<td>{format(s.springStartDate)} - {format(s.springEndDate)}</td>
				</tr>
				<tr>
					<th>Regular Season</th>
					<td>{format(s.regularSeasonStartDate)} - {format(s.regularSeasonEndDate)}</td>
				</tr>
				<tr>
					<th>All-Star Game</th>
					<td>{format(s.allStarDate)}</td>
				</tr>
				<tr>
					<th>Postseason</th>
					<td>{format(s.postSeasonStartDate)} - {format(s.postSeasonEndDate)}</td>
				</tr>
			</tbody>
		</table>
	</article>
{/each}

<style>
	th,
	td {
		padding: 0 1ch;
	}
</style>
