<script lang="ts">
	import { page } from '$app/state'
	import { fetchMLB } from '$lib/fetch'
	import { formatDate } from '$lib/temporal'
	import { count } from '$lib/utils'
	import Game from '$ui/game/game.svelte'
	import Loading from '$ui/loading.svelte'
	import Metadata from '$ui/metadata.svelte'
	import { weekStore } from '$ui/schedule/store.svelte'
	import WeekPicker from '$ui/schedule/week-picker.svelte'

	const sportId = $derived(page.url.searchParams.get('sportId') || '1')
	const date = $derived(page.url.searchParams.get('date') || '')

	$effect(() => {
		if (date) weekStore.today = date
	})

	const { startDate, endDate } = $derived(weekStore)

	async function fetchSchedule() {
		return await fetchMLB<MLB.ScheduleResponse>('/api/v1/schedule', {
			sportId,
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
			fields: [
				'dates,date,venue,description,seriesGameNumber,gamesInSeries',
				'games,gamePk,gameType,gameDate',
				'status,abstractGameState,detailedState,reason',
				'teams,away,home,team,id,name,leagueRecord,wins,losses,score',
			],
			hydrate: 'teams',
		})
	}
</script>

<Metadata title="Weekly Schedule | MLB.TheOhtani.com" description="Weekly calendar of MLB games." />

<header class="p-ch">
	<WeekPicker />
</header>

<section class="space-y-ch p-ch max-sm:px-0">
	{#await fetchSchedule()}
		<Loading>Loading schedule...</Loading>
	{:then { dates }}
		{#each dates as date}
			<details class="group" open>
				<summary class="flex items-center gap-ch px-ch">
					{formatDate(date.date + 'T00:00:00', {
						weekday: 'short',
						month: 'short',
						day: 'numeric',
					})}

					<a class="order-last underline not-hover:decoration-dashed" href="/schedule/{date.date}">
						{count(date.games.length, 'game')}
					</a>
				</summary>

				<div class="mb-lh columns-[450px] gap-lh space-y-ch *:break-inside-avoid">
					{#each date.games as game}
						<Game {game} showDescription />
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
