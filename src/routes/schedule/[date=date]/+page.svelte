<script lang="ts">
	import { fetchMLB } from '$lib/fetch'
	import { formatDate } from '$lib/temporal'
	import { count } from '$lib/utils'
	import Loading from '$ui/loading.svelte'
	import Game from '$ui/schedule/game.svelte'

	let { params } = $props()
	let totalGames = $state(0)

	async function fetchSchedule() {
		const data = await fetchMLB<MLB.ScheduleResponse>('/api/v1/schedule', {
			sportId: '1',
			date: params.date,
			fields:
				'totalGames,dates,date,games,gamePk,gameType,gameDate,status,abstractGameState,detailedState,teams,away,home,team,id,name,leagueRecord,wins,losses,venue,description',
			hydrate: 'teams',
		})

		totalGames = data.totalGames

		return data
	}
</script>

<header class="p-ch text-center">
	<h1>
		{formatDate(params.date + 'T00:00:00', { weekday: 'long', month: 'long', day: 'numeric' })}
	</h1>

	{#if totalGames > 0}
		<p>{count(totalGames, 'game')}</p>
	{/if}
</header>

<section class="p-ch">
	{#await fetchSchedule()}
		<Loading>Loading {params.date} schedule...</Loading>
	{:then { dates }}
		{#each dates as date}
			<div class="columns-[450px] *:break-inside-avoid">
				{#each date.games as game}
					<Game {game} />
				{/each}
			</div>
		{:else}
			<div class="text-center">No games.</div>
		{/each}
	{/await}
</section>
