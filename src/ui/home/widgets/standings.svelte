<script lang="ts">
	import { fetchMLB } from '#lib/fetch/index.js'
	import { favoritesStore } from '#ui/favorites/store.svelte.js'
	import { teamBg } from '#ui/data-table/types.js'
	import Logo from '#ui/team/logo.svelte'
	import { browser } from '$app/env'
	import { onMount } from 'svelte'
	import Widget from '../widget.svelte'
	import type { WidgetData } from './index.js'

	let { data }: { data: WidgetData } = $props()

	type Row = Pick<MLB.TeamRecord, 'gamesBack' | 'divisionRank'> & {
		team: Pick<MLB.Team, 'id' | 'name' | 'abbreviation'>
		wins: number
		losses: number
	}
	type Division = { division: { id: number; nameShort: string }; teamRecords: Row[] }

	let mounted = $state(false)
	onMount(() => (mounted = true))

	const favoriteTeamIds = $derived(
		mounted
			? favoritesStore.favorites
					.filter((f) => f.href.startsWith('/teams/'))
					.map((f) => Number(f.href.split('/').pop()))
			: [],
	)

	const request = $derived(
		browser
			? fetchMLB<{ records: Division[] }>('/api/v1/standings', {
					leagueId: '103,104',
					season: data.standingsSeason,
					standingsTypes: 'regularSeason',
					hydrate: 'division,team',
					fields: [
						'records,division,id,nameShort,teamRecords,team,id,name,abbreviation',
						'wins,losses,gamesBack,divisionRank',
					],
				}).then(({ records }) => records)
			: new Promise<never>(() => {}),
	)

	const final = $derived(data.phase === 'offseason' || data.phase === 'spring')
</script>

{#await request}
	<Widget title="Standings">
		<div class="h-[8lh] animate-pulse bg-current/5"></div>
	</Widget>
{:then records}
	{@const favorite = records.find((r) =>
		r.teamRecords.some((t) => favoriteTeamIds.includes(t.team.id)),
	)}

	<Widget
		title={favorite
			? `${favorite.division.nameShort}${final ? ` · ${data.standingsSeason}` : ''}`
			: `Division leaders${final ? ` · ${data.standingsSeason}` : ''}`}
		href="/standings/{data.standingsSeason}"
		linkLabel="Standings"
	>
		<table class="w-full text-sm tabular-nums">
			<thead class="text-xs text-current/50">
				<tr>
					<th class="text-left font-normal">{favorite ? 'Team' : 'Division'}</th>
					<th class="text-right font-normal">W</th>
					<th class="text-right font-normal">L</th>
					{#if favorite}<th class="text-right font-normal">GB</th>{/if}
				</tr>
			</thead>
			<tbody>
				{#if favorite}
					{#each favorite.teamRecords as row (row.team.id)}
						{@render line(row, favoriteTeamIds.includes(row.team.id))}
					{/each}
				{:else}
					{#each records as { division, teamRecords: [leader] } (division.id)}
						{#if leader}{@render line(leader, false, division.nameShort)}{/if}
					{/each}
				{/if}
			</tbody>
		</table>
	</Widget>
{:catch}
	<Widget title="Standings" href="/standings/{data.standingsSeason}" linkLabel="Standings">
		<p class="text-sm text-current/60">Couldn't load the standings.</p>
	</Widget>
{/await}

{#snippet line(row: Row, highlight: boolean, division?: string)}
	{@const colored = highlight || !!division}
	<tr class={['border-t border-stroke', highlight && 'font-bold']}>
		<td
			class={['py-[.25ch]', colored && 'relative isolate', highlight && 'border-l-2 border-l-accent']}
			style:--team-bg={colored ? teamBg(row.team) : undefined}
		>
			<a class="flex items-center gap-[.5ch] px-[.5ch] hover-link" href="/teams/{row.team.id}">
				<Logo
					srcset="https://midfield.mlbstatic.com/v1/team/{row.team.id}/spots/96"
					class="size-lh object-contain"
					team={row.team as MLB.Team}
				/>
				<span>{row.team.abbreviation}</span>
				{#if division}
					<span class="ml-auto text-xs font-normal whitespace-nowrap text-current/50"
						>{division}</span
					>
				{/if}
			</a>
		</td>
		<td class="text-right">{row.wins}</td>
		<td class="text-right">{row.losses}</td>
		{#if !division}<td class="text-right">{row.gamesBack}</td>{/if}
	</tr>
{/snippet}
