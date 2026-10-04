<script lang="ts">
	import { umpScorecardGameUrl } from '#lib/fetch/umpscorecards.js'
	import { mergeCalls, sortOfficials, trackCalls, type UmpScorecardResponse } from '#lib/umpires.js'
	import { cn } from '#lib/utils.js'
	import { browser } from '$app/env'
	import type { HTMLAttributes } from 'svelte/elements'
	import LayoutList from './layout-list.svelte'
	import LayoutMeter from './layout-meter.svelte'
	import LayoutScorecard from './layout-scorecard.svelte'
	import LayoutStrip from './layout-strip.svelte'
	import type { UmpireLayoutProps } from './types'

	let {
		gamePk,
		date,
		officials,
		feedLive,
		isFinal,
		class: className,
	}: {
		gamePk: number
		/** Official game date (YYYY-MM-DD). */
		date?: string
		officials?: MLB.Official[]
		feedLive?: MLB.LiveGameFeed | null
		isFinal: boolean
	} & HTMLAttributes<HTMLElement> = $props()

	const crew = $derived(sortOfficials(officials))
	const homePlate = $derived(crew.find((o) => o.officialType === 'Home Plate')?.official)

	const tracked = $derived(feedLive ? trackCalls(feedLive) : null)

	const teams = $derived(feedLive?.gameData.teams)

	/** UmpScorecards only grades finished games. */
	const scorecard = $derived(
		browser && isFinal && date
			? fetch(
					`/game/${gamePk}/umpires?${new URLSearchParams({ date, umpire: homePlate?.fullName ?? '' })}`,
				).then((r) => (r.ok ? (r.json() as Promise<UmpScorecardResponse>) : null))
			: Promise.resolve(null),
	)

	const layouts = [
		{ name: 'A · List', component: LayoutList },
		{ name: 'B · Scorecard', component: LayoutScorecard },
		{ name: 'C · Strip', component: LayoutStrip },
		{ name: 'D · Meter', component: LayoutMeter },
	]
</script>

{#snippet render(response: UmpScorecardResponse | null)}
	{@const calls =
		tracked && (tracked.called || response?.game) ? mergeCalls(tracked, response) : null}
	{@const props: UmpireLayoutProps = { crew, calls, teams: teams!, href: umpScorecardGameUrl(gamePk) }}

	<!-- TODO: keep one layout once picked -->
	<div class="grid gap-[2lh]">
		{#each layouts as { name, component: Layout } (name)}
			<div class="space-y-ch">
				<p class="text-center text-xs text-accent">Layout {name}</p>
				<Layout {...props} />
			</div>
		{/each}
	</div>
{/snippet}

{#if crew.length && teams}
	<section class={cn('space-y-ch px-ch', className)}>
		<h2 class="text-center text-xs text-current/40">Umpires</h2>

		{#await scorecard}
			{@render render(null)}
		{:then response}
			{@render render(response)}
		{:catch}
			{@render render(null)}
		{/await}
	</section>
{/if}
