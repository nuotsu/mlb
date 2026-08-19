<script lang="ts">
	import { isDarkOnLightTeam, isLightOnDarkTeam } from '$lib/colors'
	import type { LongestHomeRun } from '$lib/fetch/savant'
	import { formatDate } from '$lib/temporal'
	import { cn } from '$lib/utils'
	import Empty from '$ui/empty.svelte'
	import Headshot from '$ui/player/headshot.svelte'

	let { homeRuns }: { homeRuns: LongestHomeRun[] | null } = $props()

	// `table-fixed` sizes columns from the first row, so widths live on the header cells
	const COLUMNS = [
		{ key: 'dist', label: 'Projected distance (ft)', width: 'w-[8ch]' },
		{ key: 'ev', label: 'Exit velocity (mph)', width: 'w-[8ch]' },
		{ key: 'la', label: 'Launch angle', width: 'w-[7ch]' },
		{ key: 'date', label: 'Game date', width: 'w-[9ch]' },
		{ key: 'opp', label: 'Opponent', width: 'w-[8ch]' },
		{ key: 'p', label: 'Pitcher', width: 'w-[16ch] min-w-[16ch]' },
	]
</script>

<table class="min-w-full table-fixed text-center">
	<thead class="text-sm">
		<tr>
			<th class="min-w-[5ch]" colspan="4">
				<span class="block px-[.5ch] text-left uppercase">Longest HRs</span>
			</th>

			{#each COLUMNS as { key, label, width }}
				<th class={cn('px-[.5ch] whitespace-nowrap', width)}>
					<abbr title={label}>
						<span class={cn('block uppercase', key === 'dist' ? 'font-bold' : 'text-current/40')}>
							{key}
						</span>
					</abbr>
				</th>
			{/each}
		</tr>
	</thead>

	<tbody>
		{#if homeRuns?.length}
			{#each homeRuns as hr (hr.rank)}
				{@const { batter, pitcher, team, opponent } = hr}
				{@const bg = `url(https://midfield.mlbstatic.com/v1/team/${team?.id}/spots/32)`}

				<tr class="hover:[&>td]:bg-foreground/10">
					<td class="w-[3ch] text-center text-xs text-current/50">{hr.rank}</td>

					<th class="sticky left-0 z-1 w-lh min-w-lh" style:--team-bg={bg}>
						<Headshot person={batter} class="size-lh" type="silo" />
					</th>

					<th
						class={cn('relative px-[.5ch] text-left', {
							'dark:text-dark': isDarkOnLightTeam(team),
							'dark:text-light': isLightOnDarkTeam(team),
						})}
						style:--team-bg={bg}
					>
						<a
							class="line-clamp-1 w-[10ch] break-all decoration-dashed hover:underline"
							href="/player/{batter.id}"
							title={batter.fullName}
						>
							{batter.lastName ?? batter.boxscoreName ?? batter.fullName}
						</a>
					</th>

					<th
						class={cn('relative w-[4ch] min-w-[4ch] text-xs text-current/50', {
							'dark:text-dark/50': isDarkOnLightTeam(team),
							'dark:text-light/50': isLightOnDarkTeam(team),
						})}
						style:--team-bg={bg}
					>
						{team?.abbreviation ?? ''}
					</th>

					<td class="font-bold tabular-nums" class:positive={hr.distance >= 450}>
						{Math.round(hr.distance)}
					</td>

					<td class="border-l border-current/25 tabular-nums">
						{hr.launchSpeed != null ? hr.launchSpeed.toFixed(1) : '—'}
					</td>

					<td class="border-r border-current/25 tabular-nums">
						{hr.launchAngle != null ? `${Math.round(hr.launchAngle)}°` : '—'}
					</td>

					<td class="text-xs whitespace-nowrap tabular-nums">
						{#if hr.gamePk}
							<a class="decoration-dashed hover:underline" href="/game/{hr.gamePk}">
								{formatDate(hr.date, { month: 'short', day: 'numeric' })}
							</a>
						{:else}
							{formatDate(hr.date, { month: 'short', day: 'numeric' })}
						{/if}
					</td>

					<td class="text-xs whitespace-nowrap text-current/50">
						{hr.isHome ? 'vs' : '@'}
						{opponent?.abbreviation ?? ''}
					</td>

					<td class="pitcher text-xs whitespace-nowrap">
						{#if pitcher?.id}
							<a
								class="decoration-dashed hover:underline"
								href="/player/{pitcher.id}"
								title={pitcher.fullName}
							>
								{pitcher.lastName ?? pitcher.boxscoreName ?? pitcher.fullName ?? pitcher.id}
							</a>
						{:else}
							—
						{/if}
					</td>
				</tr>
			{/each}
		{:else}
			<tr>
				<td colspan="10">
					<Empty>
						{homeRuns ? 'No Statcast home runs' : 'Statcast home runs unavailable'}
					</Empty>
				</td>
			</tr>
		{/if}
	</tbody>
</table>

<style>
	td {
		padding-inline: 1ch;
		min-width: 4ch;
	}

	td.pitcher {
		min-width: 16ch;
	}
</style>
