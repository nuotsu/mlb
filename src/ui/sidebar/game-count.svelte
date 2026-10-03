<script lang="ts">
	import { fetchLiveMLB } from '#lib/fetch/live.svelte.js'
	import { formatDate, getToday } from '#lib/temporal.js'

	let { sportId = '1' }: { sportId?: string } = $props()

	const date = formatDate(getToday(), { locale: 'en-CA' })

	const schedule = $derived(
		fetchLiveMLB<MLB.ScheduleResponse>('/api/v1/schedule', {
			sportId,
			date,
			fields: ['totalGames,dates,games,status,abstractGameState'],
			hydrate: 'teams,linescore',
		}),
	)
</script>

{#if schedule.data}
	{@const { totalGames, dates } = schedule.data}
	{@const liveGames =
		dates[0]?.games.filter((g) => g.status.abstractGameState === 'Live').length ?? 0}

	{#if totalGames > 0}
		<small class="flex items-center">
			{#if liveGames > 0}
				<span class="mr-[2px] animate-pulse rounded-full text-base positive dark:text-accent">
					•
				</span>
				<b class="positive dark:text-accent">{liveGames}</b>
				<span class="text-current/50">/</span>
			{/if}
			<span class="text-current/50">{totalGames}</span>
		</small>
	{/if}
{/if}
