<script lang="ts">
	import { fetchMLB } from '$lib/fetch'
	import { formatDate } from '$lib/temporal'
	import { count } from '$lib/utils'
	import Loading from '$ui/loading.svelte'
	import Metadata from '$ui/metadata.svelte'
	import DatePicker from '$ui/schedule/date-picker.svelte'
	import Game from '$ui/schedule/game.svelte'
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
				'dates,date,games,gamePk,gameType,gameDate,status,abstractGameState,detailedState,reason,teams,away,home,team,id,name,leagueRecord,wins,losses,venue,description',
			hydrate: 'teams',
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
			<details class="group [&+&]:mt-ch" open>
				<summary class="flex items-center gap-ch">
					{formatDate(date.date + 'T00:00:00', {
						weekday: 'short',
						month: 'short',
						day: 'numeric',
					})}

					<a class="order-last underline not-hover:decoration-dashed" href="/schedule/{date.date}">
						{count(date.games.length, 'game')}
					</a>
				</summary>

				<div class="columns-[450px] *:break-inside-avoid">
					{#each date.games as game}
						<Game {game} />
					{/each}
				</div>
			</details>
		{:else}
			<div class="text-center">No games</div>
		{/each}
	{/await}
</section>

<style>
	details {
		summary::after {
			content: '▹';
			transition: rotate var(--default-transition-duration) ease-in-out;
		}

		&[open] summary::after {
			rotate: 90deg;
		}
	}
</style>
