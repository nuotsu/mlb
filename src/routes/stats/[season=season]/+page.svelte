<script lang="ts">
	import { page } from '$app/state'
	import Metadata from '$ui/metadata.svelte'
	import type { PageProps } from './$types'

	let { data }: PageProps = $props()

	let sortStat = $derived(page.url.searchParams.get('sortStat') ?? 'avg')
</script>

<Metadata
	title="{page.params.season} Stat Leaders | MLB.TheOhtani.com"
	description="MLB statistical leaders for the {page.params.season} season"
/>

<section class="flex overflow-x-auto p-ch">
	{#if data.hittingLeaders?.stats?.[0]?.splits}
		<table class="text-center">
			<thead>
				<tr>
					<th></th>
					{#each ['avg', 'homeRuns', 'hits'] as stat}
						{@const { label, name, lookupParam, ...s } =
							data.statsList.find((s) => [s.name, s.lookupParam].includes(stat)) ?? {}}
						<td>
							<abbr class="uppercase" class:font-bold={sortStat === stat} title={label ?? name}>
								<a href="?sortStat={stat}">{lookupParam ?? stat}</a>
							</abbr>
						</td>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each data.hittingLeaders.stats as { splits }}
					{#each splits as { player, stat: { avg, ...stat } }}
						<tr>
							<td class="text-left">{(player as MLB.Person).lastName}</td>
							<td class="font-sans tabular-nums" class:positive={Number(avg) >= 0.3}>
								{avg}
							</td>
							<td>{stat.homeRuns}</td>
							<td>{stat.hits}</td>
						</tr>
					{/each}
				{/each}
			</tbody>
		</table>
	{:else}
		<div class="text-center">No stats for {page.params.season} season</div>
	{/if}
</section>
