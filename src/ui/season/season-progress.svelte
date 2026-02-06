<script lang="ts">
	import { slash } from '$lib/temporal'

	let {
		currentDate,
		seasonProgress,
	}: {
		currentDate: string
		seasonProgress: {
			gamesPlayed: number
			totalGames: number
			regularSeasonStartDate?: string
			regularSeasonEndDate?: string
		}
	} = $props()

	let currentTimestamp = $derived(new Date(slash(currentDate)).getTime())

	let regularSeasonStartTimestamp = $derived(
		new Date(slash(seasonProgress.regularSeasonStartDate)!).getTime(),
	)
	let regularSeasonEndTimestamp = $derived(
		new Date(slash(seasonProgress.regularSeasonEndDate)!).getTime(),
	)
</script>

{#if currentTimestamp >= regularSeasonStartTimestamp && currentTimestamp <= regularSeasonEndTimestamp}
	<progress
		class="w-full"
		value={seasonProgress.gamesPlayed}
		max={Math.min(seasonProgress.totalGames, 162)}
	></progress>
{/if}
