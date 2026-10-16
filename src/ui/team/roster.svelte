<script lang="ts">
	import ToggleFavorite from '#ui/favorites/toggle-favorite.svelte'
	import Headshot from '#ui/player/headshot.svelte'
	import { batsThrows, groupRoster, headshotUrl } from './roster'

	let { roster, coaches }: { roster: MLB.Roster[]; coaches: MLB.Coach[] } = $props()

	const groups = $derived(groupRoster(roster))
</script>

{#each groups as { label, players } (label)}
	<dl>
		<dt
			class="sticky-below-header z-1 mb-ch flex justify-between gap-ch px-ch text-sm text-current/50 backdrop-blur-xs"
		>
			<span>{label} <span class="text-current/60">({players.length})</span></span>
			<span class="pr-[calc(1lh+1ch)]" title="Bats/Throws">B/T</span>
		</dt>

		<div class="grid px-rch max-sm:px-ch">
			{#each players as { person, position, jerseyNumber, status } (person.id)}
				{@const player = person as MLB.Person}
				<dd
					class="group/person col-span-full grid grid-cols-subgrid items-center gap-x-ch hover:bg-current/10"
				>
					<span class="w-[3ch] text-right text-sm text-current/60 tabular-nums">
						{jerseyNumber || player.primaryNumber || ''}
					</span>

					<a
						class="flex min-w-0 grow items-center gap-x-ch decoration-dashed hover:underline"
						href="/player/{person.id}"
						title={status?.description && status.description !== 'Active'
							? status.description
							: undefined}
					>
						<Headshot
							person={player}
							src={headshotUrl(person.id)}
							size={72}
							class="size-lh shrink-0 object-cover object-top"
						/>

						<span class="line-clamp-1 break-all">
							{player.lastFirstName ?? player.fullName}
						</span>
					</a>

					<span class="w-[3ch] text-center text-sm">{position.abbreviation}</span>

					<span class="text-sm text-current/60 tabular-nums">{batsThrows(player)}</span>

					<ToggleFavorite
						class="shrink-0"
						target={{ href: `/player/${person.id}`, label: player.lastName ?? player.fullName }}
					/>
				</dd>
			{/each}
		</div>
	</dl>
{/each}

{#if coaches.length}
	<dl class="accordion">
		<dt class="sticky-below-header z-1 mb-ch px-ch text-sm text-current/50 backdrop-blur-xs">
			Coaches
		</dt>

		<div class="grid px-rch max-sm:px-ch">
			{#each coaches as { person, job } (`${person.id}-${job}`)}
				<dd class="col-span-full grid grid-cols-subgrid items-center gap-x-ch hover:bg-current/10">
					<a
						class="col-span-2 flex grow items-center gap-x-ch decoration-dashed hover:underline"
						href="/player/{person.id}"
					>
						<Headshot {person} size={72} class="size-lh shrink-0" />

						<span class="line-clamp-1 break-all">
							{(person as MLB.Person).lastFirstName}
						</span>
					</a>

					<small class="col-span-3 line-clamp-1 text-right break-all">{job}</small>
				</dd>
			{/each}
		</div>
	</dl>
{/if}

<style>
	dl > div {
		grid-template-columns: auto 1fr auto auto auto;
	}
</style>
