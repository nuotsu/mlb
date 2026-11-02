<script lang="ts">
	import { pitchSpeedColor } from '#lib/colors.js'
	import type { PitchArsenalPitch } from '#lib/fetch/savant.js'
	import DataTable from '#ui/data-table/data-table.svelte'
	import type { CellArgs, DataTableColumn } from '#ui/data-table/types.js'
	import Empty from '#ui/empty.svelte'
	import Loading from '#ui/loading.svelte'
	import { browser } from '$app/env'

	let { person }: { person: MLB.Person & { stats: MLB.PlayerStats[] } } = $props()

	/** Savant's pitch-level tracking starts in 2008. */
	const FIRST_TRACKED_SEASON = 2008

	const seasons = $derived(
		[
			...new Set(
				person.stats
					?.filter(
						(s) =>
							s.type?.displayName === 'yearByYear' &&
							(s.group as unknown as MLB.StatGroupRef)?.displayName === 'pitching',
					)
					.flatMap((s) => s.splits ?? [])
					.map((split) => split.season)
					.filter((season): season is string => Number(season) >= FIRST_TRACKED_SEASON),
			),
		].sort((a, b) => Number(b) - Number(a)),
	)

	let selected = $state<string>()
	const season = $derived(selected ?? seasons[0])

	async function fetchArsenal(season: string) {
		const response = await fetch(`/player/${person.id}/arsenal?season=${season}`)

		if (!response.ok) throw new Error(`Pitch arsenal ${response.status}`)

		return (await response.json()) as PitchArsenalPitch[]
	}

	const { format: percent } = new Intl.NumberFormat('en-US', {
		style: 'percent',
		maximumFractionDigits: 1,
	})
	const mph = (n: number) => n.toFixed(1)
	const inches = (n: number) => Math.round(n).toString().replace('-', '−')

	const columns: DataTableColumn<PitchArsenalPitch>[] = [
		{
			id: 'pitch',
			header: 'Pitch',
			value: (pitch) => pitch.name,
			sticky: true,
			rowHeader: true,
			cell: pitchCell,
			cellClass: 'whitespace-nowrap',
		},
		{
			id: 'usage',
			header: 'Usage',
			title: 'Share of tracked pitches',
			value: (pitch) => pitch.usage,
			numeric: true,
			cell: usageCell,
		},
		{
			id: 'velo',
			header: 'Velo',
			title: 'Release speed (mph): average, then min–max',
			value: (pitch) => pitch.speed.avg,
			numeric: true,
			cell: veloCell,
		},
		{
			id: 'ivb',
			header: 'IVB',
			title: 'Induced vertical break (in): average, then 10th–90th percentile. Positive is rise.',
			value: (pitch) => pitch.verticalBreak?.avg,
			numeric: true,
			cell: movementCell,
		},
		{
			id: 'hb',
			header: 'HB',
			title: 'Horizontal break (in): average, then 10th–90th percentile. Positive is arm side.',
			value: (pitch) => pitch.horizontalBreak?.avg,
			numeric: true,
			cell: movementCell,
		},
	]

	function range(low: number, high: number, format: (n: number) => string) {
		const [a, b] = [format(low), format(high)]
		if (a === b) return a
		return low < 0 || high < 0 ? `${a} to ${b}` : `${a}–${b}`
	}
</script>

{#if seasons.length && season}
	<article id="pitch-arsenal" class="space-y-ch">
		<header class="flex items-center justify-center gap-ch">
			<h2 class="text-sm text-current/50">Pitch arsenal</h2>

			<select
				class="button text-center"
				name="arsenal-season"
				aria-label="Pitch arsenal season"
				value={season}
				onchange={(e) => (selected = e.currentTarget.value)}
			>
				{#each seasons as season (season)}
					<option value={season}>{season}</option>
				{/each}
			</select>
		</header>

		{#if browser}
			{#await fetchArsenal(season)}
				<Loading class="justify-center">Loading pitch arsenal...</Loading>
			{:then arsenal}
				{#if arsenal.length}
					<DataTable
						tableClass="mx-auto min-w-0"
						label="Pitch arsenal, {season}"
						data={arsenal}
						{columns}
						getRowId={(pitch) => pitch.code}
						sortParam="arsenal"
						rowClass={(_, i) => i > 0 && '*:border-t *:border-dashed *:border-t-(--color-stroke)'}
					/>
				{:else}
					<Empty>No tracked pitches in {season}</Empty>
				{/if}
			{:catch}
				<Empty>Pitch arsenal unavailable</Empty>
			{/await}
		{:else}
			<!-- Skip during SSR: Savant is slow, and the page shouldn't wait on it. -->
			<Loading class="justify-center">Loading pitch arsenal...</Loading>
		{/if}
	</article>
{/if}

{#snippet pitchCell({ row: pitch }: CellArgs<PitchArsenalPitch>)}
	{pitch.name}
	<small class="text-current/40">{pitch.code}</small>
{/snippet}

{#snippet usageCell({ row: pitch }: CellArgs<PitchArsenalPitch>)}
	{percent(pitch.usage)}
	<small class="block text-current/40">{pitch.count}</small>
{/snippet}

{#snippet veloCell({ row: pitch }: CellArgs<PitchArsenalPitch>)}
	<span style:color={pitchSpeedColor(pitch.speed.avg)}>{mph(pitch.speed.avg)}</span>
	<small class="block whitespace-nowrap text-current/40">
		{range(pitch.speed.min, pitch.speed.max, mph)}
	</small>
{/snippet}

{#snippet movementCell({ row: pitch, columnId }: CellArgs<PitchArsenalPitch>)}
	{@const movement = columnId === 'ivb' ? pitch.verticalBreak : pitch.horizontalBreak}
	{#if movement}
		{inches(movement.avg)}″
		<small class="block whitespace-nowrap text-current/40">
			{range(movement.low, movement.high, inches)}
		</small>
	{:else}
		—
	{/if}
{/snippet}
