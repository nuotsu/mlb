<script lang="ts">
	import Empty from '$ui/empty.svelte'
	import Header from '$ui/header.svelte'
	import Metadata from '$ui/metadata.svelte'
	import SportsSelect from '$ui/sports-select.svelte'
	import Logo from '$ui/team/logo.svelte'
	import type { PageProps } from './$types'

	let { data }: PageProps = $props()

	const { sport } = $derived((data.teams.teams?.[0] as MLB.TeamDetailed) ?? {})

	const teamsByLeague = $derived(
		Object.entries(
			Object.groupBy(data.teams.teams ?? [], (team: MLB.TeamDetailed) => team.league?.name ?? ''),
		).sort(([a], [b]) => a.localeCompare(b)),
	)
</script>

<Metadata
	title="{sport?.abbreviation || 'MLB'} Teams | MLB.TheOhtani.com"
	description="List of all {sport?.name || 'MLB'} teams"
/>

<Header title="{sport?.abbreviation || 'MLB'} Teams" crumbs={[{ href: '/teams', name: 'Teams' }]}>
	{#snippet afterCrumb()}
		<SportsSelect class="field-sizing-content not-hover:text-current/50" />
	{/snippet}
</Header>

<section class="grid gap-lh px-ch py-lh md:grid-cols-[repeat(auto-fit,minmax(300px,1fr))]">
	{#if data.teams?.teams}
		{#each teamsByLeague as [league, teams] (league)}
			<details open>
				<summary class="h2">{league}</summary>

				<ul>
					{#each teams?.sort((a, b) => a.name.localeCompare(b.name)) as team (team.id)}
						<li>
							<a class="group/team flex items-center gap-ch" href="/teams/{team.id}">
								<Logo class="size-lh" {team} />

								<span class="decoration-dashed group-hover/team:underline max-md:grow"
									>{team.name}</span
								>

								<small class="text-xs text-current/50">
									{(team as MLB.TeamDetailed).division?.nameShort}
								</small>
							</a>
						</li>
					{/each}
				</ul>
			</details>
		{/each}
	{:else}
		<Empty>No teams</Empty>
	{/if}
</section>
