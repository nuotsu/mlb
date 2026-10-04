<script lang="ts">
	import { percent, signed } from '#lib/umpires.js'
	import CrewMember from './crew-member.svelte'
	import Source from './source.svelte'
	import { favorOf, type UmpireLayoutProps } from './types'

	let { crew, calls, teams, href }: UmpireLayoutProps = $props()

	const favor = $derived(calls && favorOf(calls, teams))
</script>

{#snippet tile(label: string, value: string, note?: string, tone?: string)}
	<div class="grid min-w-[9ch] gap-[.25ch] px-ch text-center">
		<dt class="text-xs text-current/40">{label}</dt>
		<dd class="leading-none tabular-nums">
			<span class={tone}>{value}</span>
			{#if note}<span class="text-xs text-current/40">{note}</span>{/if}
		</dd>
	</div>
{/snippet}

<article class="mx-auto max-w-max space-y-lh">
	<ul class="flex flex-wrap justify-center gap-x-[2ch] gap-y-[.5ch]">
		{#each crew as official (official.official.id)}
			<li><CrewMember {official} /></li>
		{/each}
	</ul>

	{#if calls}
		<div class="space-y-ch">
			<dl class="flex flex-wrap justify-center divide-x divide-stroke">
				{@render tile('HP accuracy', percent(calls.accuracy))}

				{#if calls.aboveExpected != null}
					{@render tile(
						'vs expected',
						`${signed(calls.aboveExpected * 100, 1)}%`,
						undefined,
						calls.aboveExpected >= 0 ? 'positive' : 'negative',
					)}
				{/if}

				{@render tile('Missed', String(calls.incorrect), `/${calls.called}`)}

				{#if calls.consistency != null}
					{@render tile('Consistency', percent(calls.consistency))}
				{/if}

				{@render tile(
					'Favor',
					favor ? `${favor.team.abbreviation} +${favor.label}` : 'Even',
					favor?.unit,
				)}

				{#if calls.abs.challenges}
					{@render tile('ABS flips', `${calls.abs.overturned}/${calls.abs.challenges}`)}
				{/if}
			</dl>

			<p class="text-center"><Source {calls} {href} /></p>
		</div>
	{/if}
</article>
