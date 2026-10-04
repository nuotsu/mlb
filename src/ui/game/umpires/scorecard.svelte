<script lang="ts">
	import { percent, signed } from '#lib/umpires.js'
	import CrewMember from './crew-member.svelte'
	import Source from './source.svelte'
	import { favorOf, type ScorecardProps } from './types'
	import ZonePlot from './zone-plot.svelte'

	let { crew, calls, teams, href }: ScorecardProps = $props()

	const homePlate = $derived(crew.find((o) => o.officialType === 'Home Plate'))
	const rest = $derived(crew.filter((o) => o !== homePlate))
	const favor = $derived(calls && favorOf(calls, teams))
</script>

<article class="mx-auto flex max-w-max flex-wrap items-start justify-center gap-x-[3ch] gap-y-lh">
	{#if calls}
		<figure class="flex shrink-0 flex-col items-center gap-[.5ch]">
			<ZonePlot class="h-[7lh]" misses={calls.misses} />
			<figcaption class="flex gap-ch text-xs text-current/40">
				<span class="flex items-center gap-[.5ch]">
					<i class="size-[1ch] rounded-full bg-red-500"></i> Strike
				</span>
				<span class="flex items-center gap-[.5ch]">
					<i class="size-[1ch] rounded-full border border-sky-500 bg-sky-500/15"></i> Ball
				</span>
			</figcaption>
		</figure>
	{/if}

	<div class="space-y-ch">
		{#if homePlate}
			<CrewMember official={homePlate} />
		{/if}

		{#if calls}
			<div class="flex items-baseline gap-ch tabular-nums">
				<span class="text-3xl leading-none font-bold">{percent(calls.accuracy)}</span>
				{#if calls.aboveExpected != null}
					<span class={calls.aboveExpected >= 0 ? 'positive' : 'negative'}>
						{signed(calls.aboveExpected * 100, 1)}% vs exp.
					</span>
				{/if}
			</div>

			<dl class="description-list gap-x-[2ch] text-sm tabular-nums">
				<dt>Correct</dt>
				<dd>{calls.correct} / {calls.called}</dd>

				<dt>Missed</dt>
				<dd>
					{calls.badStrikes}
					<span class="text-xs text-current/40">K</span>
					· {calls.missedStrikes}
					<span class="text-xs text-current/40">B</span>
				</dd>

				{#if calls.consistency != null}
					<dt>Consistency</dt>
					<dd>{percent(calls.consistency)}</dd>
				{/if}

				<dt>Favor</dt>
				<dd>
					{#if favor}
						{favor.team.abbreviation} +{favor.label}
						<span class="text-xs text-current/40">{favor.unit}</span>
					{:else}
						Even
					{/if}
				</dd>

				{#if calls.abs.challenges}
					<dt>ABS</dt>
					<dd>{calls.abs.overturned} of {calls.abs.challenges} overturned</dd>
				{/if}

				{#if calls.season?.accuracy != null}
					<dt>Season</dt>
					<dd>
						{percent(calls.season.accuracy)}
						{#if calls.season.games}
							<span class="text-xs text-current/40">in {calls.season.games} G</span>
						{/if}
					</dd>
				{/if}
			</dl>

			<Source {calls} {href} />
		{/if}
	</div>

	{#if rest.length}
		<ul class="grid gap-[.5ch] self-center text-sm">
			{#each rest as official (official.official.id)}
				<li><CrewMember {official} headshot={false} /></li>
			{/each}
		</ul>
	{/if}
</article>
