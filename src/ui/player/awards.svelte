<script lang="ts">
	import Divider from '#ui/divider.svelte'

	let {
		person,
	}: {
		person: MLB.Person & {
			awards?: MLB.Award[]
		}
	} = $props()

	/** One row per award, most recently won first, with the distinct seasons it was won in. */
	const awards = $derived.by(() => {
		const byId = new Map<string, { id: string; name: string; count: number; seasons: string[] }>()

		const sorted = (person.awards ?? []).toSorted((a, b) =>
			(b.date ?? b.season ?? '').localeCompare(a.date ?? a.season ?? ''),
		)

		for (const { id, name, season } of sorted) {
			const award = byId.get(id) ?? { id, name, count: 0, seasons: [] }
			award.count++
			if (season && !award.seasons.includes(season)) award.seasons.push(season)
			byId.set(id, award)
		}

		return [...byId.values()]
	})
</script>

{#if awards.length}
	<section class="px-ch">
		<Divider>Awards</Divider>

		<ul class="mx-auto grid max-w-2xl gap-y-[.5lh]">
			{#each awards as { id, name, count, seasons } (id)}
				<li class="flex flex-wrap items-baseline justify-between gap-x-ch">
					<span>
						{name}

						{#if count > 1}
							<small class="text-current/50">×{count}</small>
						{/if}
					</span>

					<span class="ml-auto text-sm text-current/50">
						{seasons.toReversed().join(', ')}
					</span>
				</li>
			{/each}
		</ul>
	</section>
{/if}
