<script lang="ts">
	import { browser } from '$app/environment'
	import { fetchMLB } from '$lib/fetch'
	import { getToday } from '$lib/temporal'
	import Empty from '$ui/empty.svelte'
	import Loading from '$ui/loading.svelte'
	import HotColdZones from '$ui/stats/hot-cold-zones.svelte'
	import SelectSeason from '$ui/stats/select-season.svelte'

	let {
		group,
		person,
		baseballStats,
	}: {
		group: 'hitting' | 'pitching'
		person: MLB.Person
		baseballStats: MLB.BaseballStat[]
	} = $props()

	let season = $derived(getToday().getFullYear().toString())

	async function fetchHotColdZones() {
		const { stats } = await fetchMLB<MLB.PlayerStatsResponse>(`/api/v1/people/${person.id}/stats`, {
			stats: 'hotColdZones',
			group,
			season,
		})

		return stats?.[0]
	}
</script>

<SelectSeason
	name="season"
	onchange={(e) => {
		season = e.currentTarget.value
		fetchHotColdZones()
	}}
/>

{#if browser}
	{#await fetchHotColdZones()}
		<Loading class="justify-center">Loading hot/cold zones...</Loading>
	{:then hotColdZones}
		{#if hotColdZones}
			<HotColdZones {hotColdZones} {baseballStats} data-group={group} />
		{:else}
			<Empty>No hot/cold zones data</Empty>
		{/if}
	{/await}
{:else}
	<!-- Skip during SSR: the fetch can't finish before the response streams, so it only holds the serverless instance open. -->
	<Loading class="justify-center">Loading hot/cold zones...</Loading>
{/if}
