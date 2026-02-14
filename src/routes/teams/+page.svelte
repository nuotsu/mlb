<script lang="ts">
	import { cn } from '$lib/utils'
	import Empty from '$ui/empty.svelte'
	import Header from '$ui/header.svelte'
	import Metadata from '$ui/metadata.svelte'
	import SelectSport from '$ui/select-sport.svelte'
	import Logo from '$ui/team/logo.svelte'
	import ToggleAllDetails from '$ui/toggle-all-details.svelte'
	import type { PageProps } from './$types'

	let { data }: PageProps = $props()

	const { sport } = $derived((data.teams.teams?.[0] as MLB.TeamDetailed) ?? {})

	const teamsByLeague = $derived(
		Object.entries(
			Object.groupBy(data.teams.teams ?? [], (team: MLB.TeamDetailed) => team.league?.name ?? ''),
		).sort(([a], [b]) => (!a ? 1 : !b ? -1 : a.localeCompare(b))),
	)
</script>

<Metadata
	title="{sport?.abbreviation || 'MLB'} Teams | MLB.TheOhtani.com"
	description="List of all {sport?.name || 'MLB'} teams"
/>

<Header
	class="*:flex-nowrap"
	title={sport?.name ?? 'Teams'}
	crumbs={[{ href: '/teams', name: 'Teams' }]}
>
	{#snippet after()}
		<div class="mx-auto flex items-center gap-ch">
			<SelectSport class="button w-full shrink text-center" />
			<ToggleAllDetails />
		</div>
	{/snippet}
</Header>

<section
	class={cn(
		'gap-x-lh gap-y-px py-lh sm:px-ch',
		teamsByLeague.length > 3
			? '*:break-inside-avoid not-has-[.empty]:columns-2xs'
			: 'grid md:grid-cols-[repeat(auto-fit,minmax(var(--container-2xs),1fr))]',
	)}
>
	{#if data.teams?.teams}
		{#each teamsByLeague as [league, teams] (league)}
			{@const teamsByDivision = Object.entries(
				Object.groupBy(teams ?? [], (team: MLB.TeamDetailed) => team.division?.nameShort ?? ''),
			).sort(
				([, a], [, b]) =>
					(a?.[0] as MLB.TeamDetailed)?.division?.sortOrder! -
					(b?.[0] as MLB.TeamDetailed)?.division?.sortOrder!,
			)}

			<details class="accordion" open>
				<summary class="sticky-below-header z-1 backdrop-blur-xs">
					{league || (teamsByLeague.length === 1 ? sport?.abbreviation : 'Other')}
				</summary>

				<dl class="max-sm:px-ch">
					{#each teamsByDivision as [division, divisionTeams] (division)}
						{#if teamsByDivision.length > 1}
							<dt class="mb-[.5ch] text-sm text-current/50">
								{division || 'Other'}
							</dt>
						{/if}

						{#each divisionTeams?.sort( (a, b) => a.name.localeCompare(b.name), ) ?? [] as team (team.id)}
							<dd class="[&:has(+dt)]:mb-ch">
								<a class="group/team flex items-center gap-ch" href="/teams/{team.id}">
									<Logo class="size-lh" {team} />

									<span
										class="line-clamp-1 break-all decoration-dashed group-hover/team:underline max-md:grow"
									>
										{team.name}
									</span>
								</a>
							</dd>
						{/each}
					{/each}
				</dl>
			</details>
		{/each}
	{:else}
		<Empty class="empty">No teams</Empty>
	{/if}
</section>
