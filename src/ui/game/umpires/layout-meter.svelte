<script lang="ts">
	import { MEDIAN_ACCURACY, percent, signed } from '#lib/umpires.js'
	import CrewMember from './crew-member.svelte'
	import Source from './source.svelte'
	import { favorOf, type UmpireLayoutProps } from './types'

	let { crew, calls, teams, href }: UmpireLayoutProps = $props()

	const homePlate = $derived(crew.find((o) => o.officialType === 'Home Plate'))
	const rest = $derived(crew.filter((o) => o !== homePlate))
	const favor = $derived(calls && favorOf(calls, teams))

	/** Accuracy scale: nearly every game lands between 85% and 100%. */
	const [MIN, MAX] = [0.85, 1]
	const position = (value: number) =>
		`${(Math.min(1, Math.max(0, (value - MIN) / (MAX - MIN))) * 100).toFixed(1)}%`
</script>

<article class="mx-auto grid w-full max-w-[60ch] gap-ch">
	<header class="flex flex-wrap items-baseline justify-between gap-x-ch">
		{#if homePlate}
			<CrewMember official={homePlate} />
		{/if}

		{#if calls}
			<span class="tabular-nums">
				<b>{percent(calls.accuracy)}</b>
				{#if calls.aboveExpected != null}
					<span class={calls.aboveExpected >= 0 ? 'positive' : 'negative'}>
						{signed(calls.aboveExpected * 100, 1)}%
					</span>
				{/if}
			</span>
		{/if}
	</header>

	{#if calls}
		<div class="grid gap-[.5ch]">
			<!-- Accuracy meter -->
			<div
				class="relative h-[1ch] rounded-full bg-current/10"
				role="meter"
				aria-label="Home plate accuracy"
				aria-valuemin={MIN * 100}
				aria-valuemax={MAX * 100}
				aria-valuenow={Number((calls.accuracy * 100).toFixed(1))}
			>
				<div
					class="absolute inset-y-0 left-0 rounded-full bg-accent"
					style:width={position(calls.accuracy)}
				></div>
				{#if calls.expectedAccuracy != null}
					<div
						class="absolute -inset-y-[.25ch] w-[2px] bg-current"
						style:left={position(calls.expectedAccuracy)}
						title="Expected {percent(calls.expectedAccuracy)}"
					></div>
				{/if}
				{#if calls.source === 'umpscorecards'}
					<div
						class="absolute -inset-y-[.25ch] w-px bg-current/40"
						style:left={position(MEDIAN_ACCURACY)}
						title="League median {percent(MEDIAN_ACCURACY)}"
					></div>
				{/if}
			</div>

			<div class="flex justify-between text-xs text-current/40 tabular-nums">
				<span>{percent(MIN, 0)}</span>
				<span>
					{#if calls.expectedAccuracy != null}exp. {percent(calls.expectedAccuracy)}{/if}
					{#if calls.source === 'umpscorecards'}· lg. median {percent(MEDIAN_ACCURACY)}{/if}
				</span>
				<span>{percent(MAX, 0)}</span>
			</div>
		</div>

		<!-- Missed calls split, plus who they helped -->
		<div class="flex flex-wrap items-center gap-x-ch gap-y-[.5ch] text-sm tabular-nums">
			<span class="text-xs text-current/40">{calls.incorrect} missed</span>
			<div class="flex h-[1ch] min-w-[10ch] grow overflow-hidden rounded-full bg-current/10">
				{#if calls.incorrect}
					<div
						class="bg-red-500"
						style:flex-grow={calls.badStrikes}
						title="{calls.badStrikes} called strikes out of the zone"
					></div>
					<div
						class="bg-sky-500"
						style:flex-grow={calls.missedStrikes}
						title="{calls.missedStrikes} called balls in the zone"
					></div>
				{/if}
			</div>
			<span class="flex items-center gap-[.5ch] text-xs">
				<i class="size-[1ch] rounded-full bg-red-500"></i>{calls.badStrikes} K
				<i class="ml-[.5ch] size-[1ch] rounded-full bg-sky-500"></i>{calls.missedStrikes} B
			</span>
			<span class="text-current/40">·</span>
			<span>
				{#if favor}
					{favor.team.abbreviation} +{favor.label}
					<span class="text-xs text-current/40">{favor.unit}</span>
				{:else}
					Even
				{/if}
			</span>
			{#if calls.abs.challenges}
				<span class="text-current/40">·</span>
				<span>ABS {calls.abs.overturned}/{calls.abs.challenges}</span>
			{/if}
		</div>
	{/if}

	{#if rest.length}
		<ul class="grid grid-cols-2 gap-x-[2ch] gap-y-[.5ch] text-sm sm:grid-cols-3">
			{#each rest as official (official.official.id)}
				<li><CrewMember {official} headshot={false} /></li>
			{/each}
		</ul>
	{/if}

	{#if calls}
		<p class="text-right"><Source {calls} {href} /></p>
	{/if}
</article>
