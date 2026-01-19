<script lang="ts">
	import { fetchMLB } from '$lib/fetch'
	import { cn } from '$lib/utils'

	let { game }: { game: MLB.Game } = $props()

	async function fetchLinescore() {
		return await fetchMLB<MLB.Linescore>(`/api/v1/game/${game.gamePk}/linescore`, {})
	}
</script>

<div class="no-scrollbar overflow-x-auto" style:grid-area="linescore">
	<table class="min-w-full table-fixed text-center">
		<tbody>
			{#await fetchLinescore() then { innings = [], scheduledInnings = 9, currentInning, teams }}
				{@const remainingInnings = Array.from(
					{ length: scheduledInnings - innings.length },
					(_, i) => i + innings.length + 1,
				)}

				<tr class="align-bottom text-xs opacity-25">
					{#each innings as { num }}
						<th>{num}</th>
					{/each}

					{#each remainingInnings as num}
						<th>{num}</th>
					{/each}

					<th><abbr title="Hits">H</abbr></th>
					<th><abbr title="Errors">E</abbr></th>
					<th><abbr title="Left on base">LOB</abbr></th>
				</tr>

				<tr>
					{#each innings as { num, away }}
						<td
							class={cn(
								'nth-[3n]:border-r',
								num == currentInning ? 'border-current/25' : 'border-current/10',
							)}
							class:opacity-40={away?.runs === 0}>{away?.runs}</td
						>
					{/each}

					{#each remainingInnings as num}
						<td
							class={cn(
								'nth-[3n]:border-r',
								num == currentInning ? 'border-current/25' : 'border-current/10',
							)}
						></td>
					{/each}

					<td class="border-l! border-current/50">{teams?.away.hits}</td>
					<td>{teams?.away.errors}</td>
					<td>{teams?.away.leftOnBase}</td>
					<td></td>
				</tr>

				<tr>
					{#each innings as { num, home }}
						<td
							class={cn(
								'nth-[3n]:border-r',
								num == currentInning ? 'border-current/25' : 'border-current/10',
							)}
							class:opacity-40={home?.runs === 0}>{home?.runs}</td
						>
					{/each}

					{#each remainingInnings as num}
						<td
							class={cn(
								'nth-[3n]:border-r',
								num == currentInning ? 'border-current/25' : 'border-current/10',
							)}
						></td>
					{/each}

					<td class="border-l! border-current/50">{teams?.home.hits}</td>
					<td>{teams?.home.errors}</td>
					<td>{teams?.home.leftOnBase}</td>
				</tr>
			{/await}
		</tbody>
	</table>
</div>

<style>
	th {
		font-weight: normal;
		min-width: 3ch;
	}
</style>
