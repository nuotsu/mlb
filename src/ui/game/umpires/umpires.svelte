<script lang="ts">
	import { umpScorecardGameUrl } from '#lib/fetch/umpscorecards.js'
	import { mergeCalls, sortOfficials, trackCalls, type UmpScorecardResponse } from '#lib/umpires.js'
	import { cn } from '#lib/utils.js'
	import { browser } from '$app/env'
	import type { HTMLAttributes } from 'svelte/elements'
	import Scorecard from './scorecard.svelte'

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
</script>

{#snippet render(response: UmpScorecardResponse | null)}
	{@const calls =
		tracked && (tracked.called || response?.game) ? mergeCalls(tracked, response) : null}

	<Scorecard {crew} {calls} teams={teams!} href={umpScorecardGameUrl(gamePk)} />
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
