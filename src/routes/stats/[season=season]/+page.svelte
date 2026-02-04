<script lang="ts">
	import { goto } from '$app/navigation'
	import { page } from '$app/state'
	import { isDarkOnLightTeam, isLightOnDarkTeam } from '$lib/colors'
	import { cn } from '$lib/utils'
	import Metadata from '$ui/metadata.svelte'
	import Headshot from '$ui/player/headshot.svelte'
	import SeasonPicker from '$ui/stats/season-picker.svelte'
	import type { PageProps } from './$types'

	let { data }: PageProps = $props()

	let positionPlayers = $derived(
		data.positions.filter(
			(p) => p.gamePosition && !p.pitcher && !['PH', 'PR', 'EH'].includes(p.abbrev),
		),
	)

	let sortStat = $derived(page.url.searchParams.get('sortStat') ?? 'homeRuns')

	function withParam(key: string, value: string) {
		const params = new URLSearchParams(page.url.searchParams)
		if (value) {
			params.set(key, value)
		} else {
			params.delete(key)
		}
		const qs = params.toString()
		return qs ? `?${qs}` : page.url.pathname
	}
</script>

<Metadata
	title="{page.params.season} Stat Leaders | MLB.TheOhtani.com"
	description="MLB statistical leaders for the {page.params.season} season"
/>

<header class="p-ch">
	<SeasonPicker />
</header>

<article class="overflow-x-auto p-ch has-[table]:flex">
	<table class="min-w-full table-fixed text-center">
		<thead class="text-sm">
			<tr>
				<th></th>

				<th class="max-w-[8ch]" colspan="3">
					<select
						class="w-full text-center"
						onchange={(e) => {
							const { value } = e.target as HTMLSelectElement
							goto(withParam('position', value))
						}}
					>
						<option value="">All positions</option>
						{#each positionPlayers as { abbrev, formalName }}
							<option value={abbrev}>{abbrev} — {formalName}</option>
						{/each}
					</select>
				</th>

				{#each ['avg', 'homeRuns', 'rbi', 'hits', 'doubles', 'triples', 'stolenBases', 'obp', 'slg', 'ops'] as stat}
					{@const { label, name, lookupParam } =
						data.baseballStats.find((s) => [s.name, s.lookupParam].includes(stat)) ?? {}}
					<th>
						<abbr title={label ?? name}>
							<a
								href={withParam('sortStat', stat)}
								class={cn(
									'block uppercase',
									sortStat === stat ? 'bg-foreground font-bold text-background' : 'text-current/40',
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
			{#if data.hittingLeaders?.stats?.[0]?.splits.length}
				{#each data.hittingLeaders.stats as { splits }}
					{#each splits as { player, stat, ...split }}
						<tr class="hover:[&>td]:bg-foreground/10">
							{@render p(player as MLB.Person, split as MLB.StatSplit)}
							<td class="font-sans tabular-nums" class:positive={Number(stat.avg) >= 0.3}>
								{stat.avg}
							</td>
							<td class="font-sans tabular-nums">{stat.homeRuns}</td>
							<td class="border-r border-current/25 font-sans tabular-nums">{stat.rbi}</td>
							<td class="font-sans tabular-nums">{stat.hits}</td>
							<td class="font-sans tabular-nums">{stat.doubles}</td>
							<td class="border-r border-current/25 font-sans tabular-nums">{stat.triples}</td>
							<td class="border-r border-current/25 font-sans tabular-nums">{stat.stolenBases}</td>
							<td class="font-sans tabular-nums">{stat.obp}</td>
							<td class="font-sans tabular-nums">{stat.slg}</td>
							<td class="font-sans tabular-nums" class:positive={Number(stat.ops) >= 1}>
								{stat.ops}
							</td>
						</tr>
					{/each}
				{/each}
			{:else}
				<tr>
					<td colspan="14" class="p-ch">No hitting stats</td>
				</tr>
			{/if}
		</tbody>
	</table>
</article>

<article class="overflow-x-auto p-ch has-[table]:flex">
	<table class="min-w-full table-fixed text-center">
		<thead class="text-sm">
			<tr>
				<th colspan="4" class="max-w-[10ch]"></th>
				{#each ['era', 'wins', 'losses', 'saves', 'strikeOuts', 'whip', 'inningsPitched'] as stat}
					{@const { label, name, lookupParam } =
						data.baseballStats.find((s) => [s.name, s.lookupParam].includes(stat)) ?? {}}

					<th>
						<abbr title={label ?? name}>
							<a
								href={withParam('sortStat', stat)}
								class={cn(
									'block uppercase',
									sortStat === stat ? 'bg-foreground font-bold text-background' : 'text-current/40',
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
			{#if data.pitchingLeaders?.stats?.[0]?.splits.length}
				{#each data.pitchingLeaders.stats as { splits }}
					{#each splits as { player, stat, ...split }}
						<tr class="hover:[&>td]:bg-foreground/10">
							{@render p(player as MLB.Person, split as MLB.StatSplit)}
							<td
								class="border-r border-current/25 font-sans tabular-nums"
								class:positive={Number(stat.era) < 3}
							>
								{stat.era}
							</td>
							<td class="font-sans tabular-nums">{stat.wins}</td>
							<td class="font-sans tabular-nums">{stat.losses}</td>
							<td class="border-r border-current/25 font-sans tabular-nums">{stat.saves}</td>
							<td class="border-r border-current/25 font-sans tabular-nums">{stat.strikeOuts}</td>
							<td class="font-sans tabular-nums" class:positive={Number(stat.whip) < 1}>
								{stat.whip}
							</td>
							<td class="font-sans tabular-nums">{stat.inningsPitched}</td>
						</tr>
					{/each}
				{/each}
			{:else}
				<tr>
					<td colspan="11" class="p-ch">No pitching stats</td>
				</tr>
			{/if}
		</tbody>
	</table>
</article>

{#snippet p(person: MLB.Person, { rank, position, league, team }: MLB.StatSplit)}
	{@const bg = `url(https://midfield.mlbstatic.com/v1/team/${team?.id}/spots/32)`}

	<th class="w-[2ch] px-[.5ch] text-center text-xs">{rank}</th>

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

	<th class="relative w-[3ch] min-w-[3ch] text-xs text-current/50" style:--team-bg={bg}>
		{position?.abbreviation}
	</th>
{/snippet}

<style>
	td {
		padding-inline: 1ch;
		min-width: 4ch;
	}
</style>
