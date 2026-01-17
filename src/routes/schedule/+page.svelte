<script lang="ts">
	import { fetchMLB } from '$lib/fetch'
	import { formatDate } from '$lib/temporal'
	import { count } from '$lib/utils'
	import Loading from '$ui/loading.svelte'
	import Metadata from '$ui/metadata.svelte'
	import DatePicker from '$ui/schedule/date-picker.svelte'
	import { scheduleStore } from '$ui/schedule/store.svelte'

	const { startDate, endDate } = $derived(scheduleStore)

	async function fetchSchedule() {
		return await fetchMLB<MLB.ScheduleResponse>('/api/v1/schedule', {
			sportId: '1',
			startDate: formatDate(startDate, {
				year: 'numeric',
				month: '2-digit',
				day: '2-digit',
			}),
			endDate: formatDate(endDate, {
				year: 'numeric',
				month: '2-digit',
				day: '2-digit',
			}),
			fields:
				'dates,date,games,gamePk,gameType,gameDate,status,abstractGameState,detailedState,teams,away,home,team,id,name,leagueRecord,wins,losses,pct,venue,seriesDescription',
		})
	}
</script>

<Metadata title="Schedule | MLB.TheOhtani.com" description="Weekly calendar of MLB games." />

<section class="p-ch">
	<DatePicker />

	{#await fetchSchedule()}
		<Loading>Loading schedule...</Loading>
	{:then { dates }}
		{#each dates as date}
			<details open>
				<summary>
					{formatDate(date.date + 'T00:00:00', { month: 'short', day: 'numeric' })}
					—
					{count(date.games.length, 'game')}
				</summary>

				{#each date.games as game}
					<div class="grid grid-cols-[auto_1fr] gap-ch">
						<time class="tabular-nums" datetime={game.gameDate}>
							{formatDate(game.gameDate, { hour: '2-digit', minute: '2-digit' })}
						</time>

						<div>
							<span class="inline-block">{game.teams.away.team.name}</span>
							@
							<span class="inline-block">{game.teams.home.team.name}</span>
						</div>
					</div>
				{/each}
			</details>
		{:else}
			<div>No games.</div>
		{/each}
	{/await}
</section>
