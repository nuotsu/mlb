<script lang="ts">
	import { buildSections, standardKeys, tallyLeads, type ComparePlayer } from '#lib/compare.js'
	import { formatDate, getToday } from '#lib/temporal.js'
	import Controls from '#ui/compare/controls.svelte'
	import { fetchComparison } from '#ui/compare/fetch.js'
	import LayoutBars from '#ui/compare/layout-bars.svelte'
	import LayoutTable from '#ui/compare/layout-table.svelte'
	import LayoutTiles from '#ui/compare/layout-tiles.svelte'
	import { LAYOUTS, type CompareQuery, type LayoutId } from '#ui/compare/options.js'
	import { compareStore } from '#ui/compare/store.svelte.js'
	import Summary from '#ui/compare/summary.svelte'
	import Empty from '#ui/empty.svelte'
	import Header from '#ui/header.svelte'
	import Loading from '#ui/loading.svelte'
	import { browser } from '$app/env'
	import { goto } from '$app/navigation'
	import { page } from '$app/state'

	const today = getToday()
	const iso = (d: Date) => formatDate(d, { locale: 'en-CA' })

	let query = $state<CompareQuery>({
		ids: [],
		group: 'hitting',
		scope: 'season',
		// Matches the year <SelectSeason> starts on
		season: today.getFullYear(),
		startDate: iso(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 30)),
		endDate: iso(today),
	})
	let selected = $state(new Set(standardKeys('hitting')))
	let layout = $state<LayoutId>(
		LAYOUTS.find((l) => l.id === page.url.searchParams.get('layout'))?.id ?? 'table',
	)

	let players = $state<ComparePlayer[]>([])
	let loading = $state(false)
	let error = $state<string>()

	// Only players, group, and scope refetch; toggling stats or layouts is instant
	$effect(() => {
		if (!browser) return
		const q = { ...$state.snapshot(query), ids: [...compareStore.ids] }
		if (!q.ids.length) {
			players = []
			return
		}
		if (q.scope === 'vsTeam' && !q.opposingTeamId) return

		let stale = false
		loading = true
		error = undefined
		fetchComparison(q)
			.then((result) => !stale && (players = result))
			.catch((e) => !stale && (error = e instanceof Error ? e.message : String(e)))
			.finally(() => !stale && (loading = false))

		return () => (stale = true)
	})

	let sections = $derived(buildSections(query.group, players, selected))
	let tally = $derived(tallyLeads(sections, players.length))

	// Keep `ids` and `layout` in the URL
	$effect(() => {
		if (!browser) return

		const url = new URL(page.url.href)
		const ids = compareStore.ids

		if (ids.length) url.searchParams.set('ids', ids.join(','))
		else url.searchParams.delete('ids')

		if (layout !== 'table') url.searchParams.set('layout', layout)
		else url.searchParams.delete('layout')

		if (url.toString() !== page.url.toString()) {
			goto(url.toString(), { replace: true, reset: false })
		}
	})
</script>

<Header
	title="Player Comparison"
	crumbs={[
		{ href: '/player', name: 'Players' },
		{ href: '/player/compare', name: 'Player Comparison' },
	]}
/>

<Controls bind:query bind:selected bind:layout />

<section
	id="compare-results"
	class="space-y-lh px-ch py-lh pb-[max(1lh,env(safe-area-inset-bottom))]"
	aria-busy={loading}
>
	{#if !compareStore.ids.length}
		<Empty>
			<p>No players to compare</p>
			<p>
				Use <strong>Compare</strong> on any <a class="link" href="/player">player page</a> to add them
				here.
			</p>
		</Empty>
	{:else if error}
		<Empty>{error}</Empty>
	{:else if !players.length && loading}
		<Loading class="justify-center" />
	{:else}
		<div class={['space-y-lh transition-opacity', loading && 'opacity-50']}>
			<Summary {players} leads={tally.leads} ranked={tally.ranked} />

			{#if !sections.length}
				<Empty>No {query.group} stats for these players</Empty>
			{:else if layout === 'bars'}
				<LayoutBars {players} {sections} />
			{:else if layout === 'tiles'}
				<LayoutTiles {players} {sections} />
			{:else}
				<LayoutTable {players} {sections} />
			{/if}

			{#if players.length === 1}
				<p class="text-center text-current/50">Add another player to see who comes out ahead.</p>
			{/if}
		</div>
	{/if}
</section>
