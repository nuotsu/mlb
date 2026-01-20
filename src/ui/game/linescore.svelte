<script lang="ts">
	import { cn } from '$lib/utils'

	let { linescore }: { linescore: MLB.Linescore } = $props()

	let innings = $derived(linescore.innings ?? [])
	let scheduledInnings = $derived(linescore.scheduledInnings ?? 0)
	let currentInning = $derived(linescore.currentInning)
	let teams = $derived(linescore.teams)

	const remainingInnings = $derived.by(() =>
		Array.from({ length: scheduledInnings - innings.length }, (_, i) => i + innings.length + 1),
	)
</script>

<div class="no-scrollbar overflow-x-auto" style:grid-area="linescore">
	<table class="min-w-full table-fixed text-center">
		<thead>
			<tr class="align-bottom text-xs opacity-25">
				{#each innings as { num }}
					<th>{num}</th>
				{/each}

				{#each remainingInnings as num}
					<th>{num}</th>
				{/each}

				<th class="w-[4ch]"><abbr title="Hits">H</abbr></th>
				<th class="w-[4ch]"><abbr title="Errors">E</abbr></th>
				<th class="w-[4ch]"><abbr title="Left on base">LOB</abbr></th>
			</tr>
		</thead>

		<tbody>
			{#each ['away', 'home'] as const as teamKey}
				{@const { hits, errors, leftOnBase } = teams?.[teamKey] as MLB.LinescoreTeam}

				<tr>
					{#each innings as inning}
						{@const bye =
							inning.num === currentInning &&
							teamKey === 'home' &&
							inning[teamKey]?.runs === undefined}

						<td
							class={cn(
								'nth-[3n]:border-r',
								inning.num == currentInning ? 'border-current/25' : 'border-current/10',
							)}
							class:opacity-40={inning[teamKey]?.runs === 0 || bye}
						>
							{#if inning.num === currentInning && teamKey === 'home' && inning[teamKey]?.runs === undefined}
								X
							{:else}
								{inning[teamKey]?.runs}
							{/if}
						</td>
					{/each}

					{#each remainingInnings as num}
						<td
							class={cn(
								'nth-[3n]:border-r',
								num == currentInning ? 'border-current/25' : 'border-current/10',
							)}
						></td>
					{/each}

					<td class="border-l! border-current/50">{hits}</td>
					<td>{errors}</td>
					<td>{leftOnBase}</td>
					<td></td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<style>
	th {
		font-weight: normal;
		min-width: 3ch;
	}

	th,
	td {
		height: 1lh;
	}

	@property --left {
		inherits: false;
		initial-value: 0;
		syntax: '<number>';
	}
	@property --right {
		inherits: false;
		initial-value: 0;
		syntax: '<number>';
	}

	div {
		--max: 2ch;
		scroll-timeline: --linescore x;
		animation: scroll var(--default-transition-duration) ease-in-out;
		animation-timeline: --linescore;
		mask-image: linear-gradient(
			to right,
			transparent,
			currentColor calc(var(--left) * var(--max)),
			currentColor calc(100% - var(--right) * var(--max)),
			transparent
		);
	}

	@keyframes scroll {
		15% {
			--left: 1;
			--right: 1;
		}
		85% {
			--right: 1;
		}
		100% {
			--left: 1;
			--right: 0;
		}
	}
</style>
