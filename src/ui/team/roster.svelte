<script lang="ts">
	import Headshot from '$ui/player/headshot.svelte'

	let { roster, coaches }: { roster: MLB.Roster[]; coaches: MLB.Coach[] } = $props()

	const batters = $derived(roster.filter(({ position }) => position.abbreviation !== 'P'))
	const pitchers = $derived(roster.filter(({ position }) => position.abbreviation === 'P'))

	function sort(arr: (MLB.Roster & { person: MLB.Person })[]) {
		return arr.sort(
			(a, b) => a.person.lastInitName?.localeCompare(b.person.lastInitName ?? '') ?? 0,
		)
	}
</script>

<article class="space-y-ch">
	<h2 class="h2">Roster</h2>

	<div class="space-y-px">
		{@render list(batters, 'Batters')}
		{@render list(pitchers, 'Pitchers')}

		<details class="accordion">
			<summary class="sticky-below-header z-1 flex items-center gap-ch backdrop-blur-xs">
				Coaches
			</summary>

			<ul class="grid">
				{#each coaches as { person, jerseyNumber, job } (person.id)}
					<li class="col-span-full grid grid-cols-subgrid gap-x-ch">
						<a
							class="group/person col-span-full grid grid-cols-subgrid items-center gap-x-ch"
							href="/player/{person.id}"
						>
							<span class="inline-block text-center text-sm not-empty:before:content-['#']">
								{jerseyNumber}
							</span>

							<Headshot {person} size={36} class="size-lh shrink-0" />

							<span class="line-clamp-1 break-all decoration-dashed group-hover/person:underline">
								{(person as MLB.Person).lastInitName}
							</span>

							<span class="line-clamp-1 break-all">{job}</span>
						</a>
					</li>
				{/each}
			</ul>
		</details>
	</div>
</article>

{#snippet list(arr: MLB.Roster[], label: string, open?: boolean)}
	<details class="accordion" open>
		<summary class="sticky-below-header z-1 flex items-center gap-ch backdrop-blur-xs">
			{label}
		</summary>

		<ul class="grid">
			{#each sort(arr) as { person, jerseyNumber, position } (person.id)}
				<li class="col-span-full grid grid-cols-subgrid gap-x-ch">
					<a
						class="group/person col-span-full grid grid-cols-subgrid items-center gap-x-ch"
						href="/player/{person.id}"
					>
						<span class="inline-block text-center text-sm not-empty:before:content-['#']">
							{jerseyNumber}
						</span>

						<span class="w-[3rch] text-center text-sm">{position.abbreviation}</span>

						<Headshot {person} size={36} class="size-lh shrink-0" />

						<span class="line-clamp-1 break-all decoration-dashed group-hover/person:underline">
							{(person as MLB.Person).lastInitName}
						</span>
					</a>
				</li>
			{/each}
		</ul>
	</details>
{/snippet}

<style>
	ul {
		grid-template-columns: auto auto auto 1fr;
	}
</style>
