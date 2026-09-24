<script lang="ts">
	import { browser } from '$app/environment'
	import { pitchSpeedColor } from '$lib/colors'
	import type { PitchArsenalPitch } from '$lib/fetch/savant'
	import Empty from '$ui/empty.svelte'
	import Loading from '$ui/loading.svelte'

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

	function range(low: number, high: number, format: (n: number) => string) {
		const [a, b] = [format(low), format(high)]
		if (a === b) return a
		return low < 0 || high < 0 ? `${a} to ${b}` : `${a}–${b}`
	}
</script>

{#if seasons.length && season}
	<article class="space-y-ch">
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
					<div class="overflow-x-auto">
						<table class="mx-auto text-center">
							<thead class="text-sm">
								<tr class="text-current/40">
									<th class="px-[.5ch] text-left font-normal">Pitch</th>
									<th class="px-[.5ch] font-normal">
										<abbr title="Share of tracked pitches">Usage</abbr>
									</th>
									<th class="px-[.5ch] font-normal">
										<abbr title="Release speed (mph): average, then min–max">Velo</abbr>
									</th>
									<th class="px-[.5ch] font-normal">
										<abbr
											title="Induced vertical break (in): average, then 10th–90th percentile. Positive is rise."
										>
											IVB
										</abbr>
									</th>
									<th class="px-[.5ch] font-normal">
										<abbr
											title="Horizontal break (in): average, then 10th–90th percentile. Positive is arm side."
										>
											HB
										</abbr>
									</th>
								</tr>
							</thead>

							<tbody>
								{#each arsenal as pitch (pitch.code)}
									<tr class="border-t border-dashed border-stroke hover:bg-foreground/10">
										<th class="px-[.5ch] text-left font-normal whitespace-nowrap">
											{pitch.name}
											<small class="text-current/40">{pitch.code}</small>
										</th>

										<td class="tabular-nums">
											{percent(pitch.usage)}
											<small class="block text-current/40">{pitch.count}</small>
										</td>

										<td class="tabular-nums">
											<span style:color={pitchSpeedColor(pitch.speed.avg)}>
												{mph(pitch.speed.avg)}
											</span>
											<small class="block whitespace-nowrap text-current/40">
												{range(pitch.speed.min, pitch.speed.max, mph)}
											</small>
										</td>

										{#each [pitch.verticalBreak, pitch.horizontalBreak] as movement, i (i)}
											<td class="tabular-nums">
												{#if movement}
													{inches(movement.avg)}″
													<small class="block whitespace-nowrap text-current/40">
														{range(movement.low, movement.high, inches)}
													</small>
												{:else}
													—
												{/if}
											</td>
										{/each}
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
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

<style>
	td {
		padding-inline: 1ch;
		padding-block: 0.25lh;
	}
</style>
