<script lang="ts">
	import ToggleFavorite from '$ui/favorites/toggle-favorite.svelte'
	import Headshot from '$ui/player/headshot.svelte'

	let { roster, coaches }: { roster: MLB.Roster[]; coaches: MLB.Coach[] } = $props()

	const batters = $derived(roster.filter(({ position }) => position.abbreviation !== 'P'))
	const pitchers = $derived(roster.filter(({ position }) => position.abbreviation === 'P'))

	function sort(arr: (MLB.Roster & { person: MLB.Person })[]) {
		return arr.sort(
			(a, b) => a.person.lastFirstName?.localeCompare(b.person.lastFirstName ?? '') ?? 0,
		)
	}
</script>

{@render list(batters, 'Batters')}
{@render list(pitchers, 'Pitchers')}

<dl class="accordion">
	<dt class="sticky-below-header z-1 mb-ch px-ch text-sm text-current/50 backdrop-blur-xs">
		Coaches
	</dt>

	<div class="grid px-rch max-sm:px-ch">
		{#each coaches as { person, job }}
			<dd class="col-span-full grid grid-cols-subgrid items-center gap-x-ch hover:bg-current/10">
				<a
					class="flex grow items-center gap-x-ch decoration-dashed hover:underline"
					href="/player/{person.id}"
				>
					<Headshot {person} size={72} class="size-lh shrink-0" />

					<span class="line-clamp-1 break-all">
						{(person as MLB.Person).lastFirstName}
					</span>
				</a>

				<small class="line-clamp-1 break-all">{job}</small>
			</dd>
		{/each}
	</div>
</dl>

{#snippet list(arr: MLB.Roster[], label: string)}
	<dl>
		<dt class="sticky-below-header z-1 mb-ch px-ch text-sm text-current/50 backdrop-blur-xs">
			{label}
		</dt>

		<div class="grid px-rch max-sm:px-ch">
			{#each sort(arr) as { person, position }}
				<dd
					class="group/person col-span-full grid grid-cols-subgrid items-center gap-x-ch hover:bg-current/10"
				>
					<span class="w-[3rch] text-center text-sm">{position.abbreviation}</span>

					<a
						class="flex grow items-center gap-x-ch decoration-dashed hover:underline"
						href="/player/{person.id}"
					>
						<Headshot {person} size={72} class="size-lh shrink-0" />

						<span class="line-clamp-1 break-all">
							{(person as MLB.Person).lastFirstName}
						</span>
					</a>

					<ToggleFavorite
						class="shrink-0"
						target={{ href: `/player/${person.id}`, label: person.lastName! }}
					/>
				</dd>
			{/each}
		</div>
	</dl>
{/snippet}

<style>
	dl > div {
		grid-template-columns: auto 1fr auto;
	}
</style>
