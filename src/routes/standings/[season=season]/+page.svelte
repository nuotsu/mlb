<script lang="ts">
	import { cn } from '$lib/utils'
	import YearPicker from '$ui/schedule/year-picker.svelte'
	import StyledTeam from '$ui/team/styled-team.svelte'
	import type { PageProps } from './$types'

	let { data }: PageProps = $props()
</script>

<header class="p-ch">
	<YearPicker />
</header>

<section
	class={cn('grid items-start gap-lh p-ch', {
		'sm:grid-cols-2 lg:grid-cols-3': data.standings.records.length > 4,
		'sm:grid-cols-2': data.standings.records.length % 2 === 0,
	})}
>
	{#each data.standings.records as { division, teamRecords }}
		<table class="w-full text-center">
			<thead>
				<tr class="text-sm text-current/25">
					<th class="line-clamp-1 break-all text-foreground">{division?.nameShort}</th>
					<th class="w-[8ch]">W-L</th>
					<th class="w-[5ch]">%</th>
					<th class="w-[5ch]">GB</th>
					<th class="w-[5ch]">Strk</th>
					<th class="w-[5ch]">#</th>
				</tr>
			</thead>
			<tbody>
				{#each teamRecords as { team, wins, losses, winningPercentage, sportGamesBack, streak, leagueRank }}
					<tr>
						<td class="sticky left-0 min-w-[3.5ch]">
							<StyledTeam class="flex-row-reverse pl-ch text-left" {team} />
						</td>
						<td class="flex justify-center font-sans tabular-nums">
							<span class="positive">{wins}</span>
							-
							<span class="negative">{losses}</span>
						</td>
						<td
							class={cn(
								'font-sans tabular-nums',
								Number(winningPercentage) >= 0.5 ? 'positive' : 'negative',
							)}>{winningPercentage}</td
						>
						<td class={cn('font-sans tabular-nums', sportGamesBack === '-' && 'text-current/25')}
							>{sportGamesBack}</td
						>
						<td
							class={cn('font-sans tabular-nums', {
								positive: streak?.streakCode?.startsWith('W'),
								negative: streak?.streakCode?.startsWith('L'),
							})}>{streak?.streakCode}</td
						>
						<td class="font-sans tabular-nums">{leagueRank}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/each}
</section>

<style>
	th {
		font-weight: normal;
	}
</style>
