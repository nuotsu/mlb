<script lang="ts">
	import { slash } from '$lib/temporal'

	let {
		currentDate,
		seasonProgress,
		class: className,
	}: {
		currentDate: string
		seasonProgress: {
			gamesPlayed: number
			totalGames: number
			regularSeasonStartDate?: string
			regularSeasonEndDate?: string
		}
		class?: string
	} = $props()

	let { gamesPlayed, regularSeasonStartDate, regularSeasonEndDate } = $derived(seasonProgress)

	const total = $derived(Math.min(seasonProgress.totalGames, 162))

	let currentTimestamp = $derived(new Date(slash(currentDate)).getTime())

	let regularSeasonStartTimestamp = $derived(new Date(slash(regularSeasonStartDate)!).getTime())
	let regularSeasonEndTimestamp = $derived(new Date(slash(regularSeasonEndDate)!).getTime())
</script>

{#if currentTimestamp >= regularSeasonStartTimestamp && currentTimestamp <= regularSeasonEndTimestamp}
	<article class="grid grid-cols-[auto_1fr_auto] gap-ch text-center text-sm {className}">
		<span>{'1'.padStart(3, '0')}</span>

		<output class="relative leading-none" style:--progress="calc({gamesPlayed / total} * 100%)">
			<div class="absolute bottom-full grid -translate-x-1/2" style:left="var(--progress)">
				<small class="text-[x-small]">Game</small>
				<b>{gamesPlayed || 1}</b>
			</div>
		</output>

		<span>{total.toString().padStart(3, '0')}</span>
	</article>
{/if}

<style>
	output {
		&::before {
			content: '';
			position: absolute;
			inset: 50% 0 auto;
			translate: 0 -50%;
			height: 1px;
			background-image: linear-gradient(
				to right,
				currentColor,
				currentColor var(--progress),
				color-mix(in srgb, currentColor 25%, transparent) var(--progress)
			);
		}

		div:after {
			content: '';
			position: absolute;
			inset: 50% auto auto 50%;
			translate: -50% 1lh;
			width: 1px;
			height: 1lh;
			background-color: currentColor;
		}
	}
</style>
