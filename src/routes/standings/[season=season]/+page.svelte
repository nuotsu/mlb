<script lang="ts">
	import { page } from '$app/state'
	import { cn } from '$lib/utils'
	import Header from '$ui/header.svelte'
	import Metadata from '$ui/metadata.svelte'
	import YearPicker from '$ui/schedule/year-picker.svelte'
	import StyledTeam from '$ui/team/styled-team.svelte'
	import type { PageProps } from './$types'

	let { data }: PageProps = $props()
</script>

<Metadata
	title="{page.params.season} MLB Standings | MLB.TheOhtani.com"
	description="MLB standings for the {page.params.season} season"
/>

<Header title="Standings" crumbs={[{ name: 'Standings' }]}>
	{#snippet after()}
		<YearPicker class="mx-auto" />
	{/snippet}
</Header>

<section
	class={cn('items-start gap-lh p-ch has-[table]:grid', {
		'sm:grid-cols-2 lg:grid-cols-3': data.standings.records.length > 4,
		'sm:grid-cols-2': data.standings.records.length % 2 === 0,
	})}
>
	{#each data.standings.records as { division, teamRecords } (division?.id)}
		<table class="w-full text-center">
			<thead>
				<tr class="text-sm text-current/50">
					<th class="line-clamp-1 break-all text-foreground">{division?.nameShort}</th>
					<th class="w-[8ch]">W-L</th>
					<th class="w-[5ch]">%</th>
					<th class="w-[5ch]">GB</th>
					<th class="w-[5ch]">Strk</th>
					<th class="w-[5ch]">#</th>
				</tr>
			</thead>
			<tbody>
				{#each teamRecords as { team, wins, losses, winningPercentage, sportGamesBack, streak, leagueRank } (team.id)}
					<tr class="hover:[&>td]:bg-foreground/10">
						<td class="sticky left-0 min-w-lh @min-[7ch]:min-w-[3.5ch]">
							<StyledTeam class="text-left" {team} linked />
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
						<td class={cn('font-sans tabular-nums', sportGamesBack === '-' && 'text-current/50')}>
							{sportGamesBack}
						</td>
						<td
							class="font-sans tabular-nums"
							class:positive={streak?.streakCode?.startsWith('W')}
							class:negative={streak?.streakCode?.startsWith('L')}
						>
							{streak?.streakCode}
						</td>
						<td class="font-sans tabular-nums">{leagueRank}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{:else}
		<div class="text-center">No standings for {page.params.season} season</div>
	{/each}
</section>

<style>
	th {
		font-weight: normal;
	}
</style>
