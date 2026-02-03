<script lang="ts">
	import { page } from '$app/state'
	import { isDarkOnLightTeam, isLightOnDarkTeam } from '$lib/colors'
	import { cn } from '$lib/utils'
	import Metadata from '$ui/metadata.svelte'
	import Headshot from '$ui/player/headshot.svelte'
	import SeasonPicker from '$ui/stats/season-picker.svelte'
	import type { PageProps } from './$types'

	let { data }: PageProps = $props()

	let sortStats = $derived((page.url.searchParams.get('sortStat') ?? 'homeRuns,era').split(','))
	let hittingSortStat = $derived(sortStats[0] ?? 'homeRuns')
	let pitchingSortStat = $derived(sortStats[1] ?? 'era')
</script>

<Metadata
	title="{page.params.season} Stat Leaders | MLB.TheOhtani.com"
	description="MLB statistical leaders for the {page.params.season} season"
/>

<header class="p-ch">
	<SeasonPicker />
</header>

<article class="overflow-x-auto p-ch has-[table]:flex">
	{#if data.hittingLeaders?.stats?.[0]?.splits.length}
		<table class="table-fixed text-center">
			<thead class="text-sm">
				<tr>
					<th colspan="3"></th>
					{#each ['avg', 'homeRuns', 'rbi', 'hits', 'doubles', 'triples', 'stolenBases', 'obp', 'slg', 'ops'] as stat}
						{@const { label, name, lookupParam } =
							data.baseballStats.find((s) => [s.name, s.lookupParam].includes(stat)) ?? {}}
						<th>
							<abbr title={label ?? name}>
								<a
									href="?sortStat={stat},{pitchingSortStat}"
									class={cn(
										'block uppercase',
										hittingSortStat === stat
											? 'bg-foreground font-bold text-background'
											: 'text-current/40',
									)}
								>
									{#if stat === 'doubles'}
										2B
									{:else if stat === 'triples'}
										3B
									{:else}
										{lookupParam ?? stat}
									{/if}
								</a>
							</abbr>
						</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each data.hittingLeaders.stats as { splits }}
					{#each splits as { player, stat, league, team }}
						<tr class="hover:[&>td]:bg-foreground/10">
							{@render p(player as MLB.Person, league, team)}
							<td class="font-sans tabular-nums" class:positive={Number(stat.avg) >= 0.3}>
								{stat.avg}
							</td>
							<td class="font-sans tabular-nums">{stat.homeRuns}</td>
							<td class="font-sans tabular-nums">{stat.rbi}</td>
							<td class="font-sans tabular-nums">{stat.hits}</td>
							<td class="font-sans tabular-nums">{stat.doubles}</td>
							<td class="font-sans tabular-nums">{stat.triples}</td>
							<td class="font-sans tabular-nums">{stat.stolenBases}</td>
							<td class="font-sans tabular-nums">{stat.obp}</td>
							<td class="font-sans tabular-nums">{stat.slg}</td>
							<td class="font-sans tabular-nums" class:positive={Number(stat.ops) >= 1}>
								{stat.ops}
							</td>
						</tr>
					{/each}
				{/each}
			</tbody>
		</table>
	{:else}
		<div class="text-center">No hitting stats</div>
	{/if}
</article>

<article class="overflow-x-auto p-ch has-[table]:flex">
	{#if data.pitchingLeaders?.stats?.[0]?.splits.length}
		<table class="table-fixed text-center">
			<thead class="text-sm">
				<tr>
					<th colspan="3"></th>
					{#each ['era', 'wins', 'losses', 'strikeOuts', 'saves', 'whip', 'inningsPitched'] as stat}
						{@const { label, name, lookupParam } =
							data.baseballStats.find((s) => [s.name, s.lookupParam].includes(stat)) ?? {}}

						<th>
							<abbr title={label ?? name}>
								<a
									href="?sortStat={hittingSortStat},{stat}"
									class={cn(
										'block uppercase',
										pitchingSortStat === stat
											? 'bg-foreground font-bold text-background'
											: 'text-current/40',
									)}
								>
									{#if stat === 'strikeOuts'}
										K
									{:else}
										{lookupParam ?? stat}
									{/if}
								</a>
							</abbr>
						</th>
					{/each}
				</tr>
			</thead>

			<tbody>
				{#each data.pitchingLeaders.stats as { splits }}
					{#each splits as { player, stat, league, team }}
						<tr class="hover:[&>td]:bg-foreground/10">
							{@render p(player as MLB.Person, league, team)}
							<td class="font-sans tabular-nums" class:positive={Number(stat.era) < 3}>
								{stat.era}
							</td>
							<td class="font-sans tabular-nums">{stat.wins}</td>
							<td class="font-sans tabular-nums">{stat.losses}</td>
							<td class="font-sans tabular-nums">{stat.strikeOuts}</td>
							<td class="font-sans tabular-nums">{stat.saves}</td>
							<td class="font-sans tabular-nums" class:positive={Number(stat.whip) < 1}>
								{stat.whip}
							</td>
							<td class="font-sans tabular-nums">{stat.inningsPitched}</td>
						</tr>
					{/each}
				{/each}
			</tbody>
		</table>
	{:else}
		<div class="text-center">No pitching stats</div>
	{/if}
</article>

{#snippet p(person: MLB.Person, league?: MLB.League, team?: MLB.Team)}
	{@const bg = `url(https://midfield.mlbstatic.com/v1/team/${team?.id}/spots/32)`}

	<th class="sticky -left-ch z-1 min-w-lh" style:--team-bg={bg}>
		<Headshot {person} class="size-lh" />
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
			href="/player/{person.id}"
		>
			{person.lastName}
		</a>
	</th>
	<th
		class={cn('relative px-[.5ch] text-left text-xs text-current/50', {
			'dark:text-dark': isDarkOnLightTeam(team),
			'dark:text-light': isLightOnDarkTeam(team),
		})}
		style:--team-bg={bg}>{league?.name}</th
	>
{/snippet}

<style>
	td {
		padding-inline: 1ch;
		min-width: 4ch;
	}
</style>
