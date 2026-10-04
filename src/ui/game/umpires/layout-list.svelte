<script lang="ts">
	import { percent, signed } from '#lib/umpires.js'
	import CrewMember from './crew-member.svelte'
	import Source from './source.svelte'
	import { favorOf, type UmpireLayoutProps } from './types'

	let { crew, calls, teams, href }: UmpireLayoutProps = $props()

	const favor = $derived(calls && favorOf(calls, teams))
</script>

<article class="mx-auto max-w-max space-y-ch">
	<dl class="grid gap-[.5ch]">
		{#each crew as official (official.official.id)}
			{@const isHomePlate = official.officialType === 'Home Plate'}

			<div class="flex flex-wrap items-center gap-x-lh gap-y-[.25ch]">
				<dt class="min-w-[18ch]">
					<CrewMember {official} />
				</dt>

				{#if isHomePlate && calls}
					<dd class="flex flex-wrap items-center gap-x-[.5ch] leading-none tabular-nums">
						<b>{percent(calls.accuracy)}</b>
						{#if calls.aboveExpected != null}
							<span
								class={calls.aboveExpected >= 0 ? 'positive' : 'negative'}
								title="Accuracy above expected"
							>
								({signed(calls.aboveExpected * 100, 1)}%)
							</span>
						{/if}
						<span class="text-current/40">·</span>
						<span>{calls.incorrect} missed</span>
						<span class="text-xs text-current/40">/ {calls.called}</span>
						{#if favor}
							<span class="text-current/40">·</span>
							<span title="Missed calls favored {favor.team.name} by {favor.label} {favor.unit}">
								+{favor.label}
								{favor.team.abbreviation}
							</span>
						{/if}
					</dd>
				{/if}
			</div>
		{/each}
	</dl>

	{#if calls}
		<p class="text-right"><Source {calls} {href} /></p>
	{/if}
</article>
