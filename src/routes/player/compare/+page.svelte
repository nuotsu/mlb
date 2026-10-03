<script lang="ts">
	import { LOWER_IS_BETTER } from '#lib/stats.js'
	import { cn } from '#lib/utils.js'
	import CompareForm from '#ui/compare/form.svelte'
	import { compareStore } from '#ui/compare/store.svelte.js'
	import Empty from '#ui/empty.svelte'
	import Header from '#ui/header.svelte'
	import Headshot from '#ui/player/headshot.svelte'
	import { browser } from '$app/env'
	import { goto } from '$app/navigation'
	import { page } from '$app/state'
	import type { PageProps } from './$types'

	let { form }: PageProps = $props()
	let people = $derived(
		form?.results?.people as unknown as (MLB.Person & { stats: MLB.PlayerStats[] })[],
	)
	let selectedStats = $derived(form?.entries.stats.split(','))
	let selectedGroup = $derived(form?.entries.group as string)

	function combineStats(stats: MLB.PlayerStats[]) {
		return Object.assign({}, ...(stats?.flatMap((s) => s.splits.map((s) => s.stat)) ?? []))
	}

	function bestValue(stat: string, group: string, values: (string | number)[]) {
		const nums = values.map(Number).filter((n) => !isNaN(n))
		if (!nums.length) return undefined
		return LOWER_IS_BETTER[group]?.has(stat) ? Math.min(...nums) : Math.max(...nums)
	}

	$effect(() => {
		if (!browser) return

		const ids = compareStore.ids
		const url = new URL(page.url.href)

		if (ids.length) {
			url.searchParams.set('ids', ids.join(','))
		} else {
			url.searchParams.delete('ids')
		}

		if (url.toString() !== page.url.toString()) {
			goto(url.toString(), { replaceState: true, reset: false })
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

<CompareForm />

<section class="py-lh pb-[max(1lh,env(safe-area-inset-bottom))] text-center sm:px-ch">
	{#if people?.length}
		<div class="grid snap-x snap-mandatory auto-cols-fr grid-flow-col overflow-x-auto">
			<ul class="mt-[2.5lh] snap-center border-t border-dashed border-stroke">
				{#each selectedStats as stat}
					<li class="line-clamp-1 break-all lowercase first-letter:capitalize">
						{stat?.split(/(?=[A-Z])/g).join(' ')}
					</li>
				{/each}
			</ul>

			{#each people as { id, fullName, stats }, i (id)}
				<dl class="snap-start" class:order-first={i === 0}>
					<dt class="border-b border-dashed border-stroke">
						<a class="group/person flex flex-col items-center" href="/player/{id}">
							<Headshot class="size-[1.5lh] shrink-0" person={{ id }} size={96} />

							<span class="line-clamp-1 break-all decoration-dashed group-hover/person:underline">
								{fullName}
							</span>
						</a>
					</dt>

					{#each selectedStats as stat}
						{@const bestStat = bestValue(
							stat,
							selectedGroup,
							people?.map((p) => combineStats(p.stats)[stat]) ?? [],
						)}
						{@const value = combineStats(stats)[stat]}

						<dd
							class={cn(
								'min-h-lh tabular-nums',
								bestStat === Number(value) && 'bg-accent/10 text-accent',
							)}
						>
							{value}
						</dd>
					{/each}
				</dl>
			{/each}
		</div>
	{:else}
		<Empty>No players to compare</Empty>
	{/if}
</section>
