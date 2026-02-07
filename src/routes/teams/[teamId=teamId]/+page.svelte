<script lang="ts">
	import Empty from '$ui/empty.svelte'
	import Header from '$ui/header.svelte'
	import Metadata from '$ui/metadata.svelte'
	import TeamSchedule from '$ui/schedule/team-schedule.svelte'
	import Logo from '$ui/team/logo.svelte'
	import Roster from '$ui/team/roster.svelte'
	import type { PageProps } from './$types'

	let { data }: PageProps = $props()

	const team = $derived(data.team as MLB.TeamDetailed)
</script>

<Metadata title="{team.name} | MLB.TheOhtani.com" description="{team.name} team page" />

<Header
	crumbs={[
		{ href: '/teams', name: 'Teams' },
		team.sport?.name ? { href: `/teams?sportId=${team.sport?.id}`, name: team.sport.name } : {},
		{ name: team.name },
	]}
>
	<div class="flex flex-wrap items-end gap-ch">
		<Logo class="size-[3lh] shrink-0 rounded-none bg-transparent" {team} />

		<h1 class="grid">
			{#if team.franchiseName !== team.clubName}
				<span>{team.franchiseName}</span>
			{/if}

			<strong class="text-3xl">{team.clubName}</strong>
		</h1>
	</div>
</Header>

<section class="grid gap-lh py-lh sm:grid-cols-2 sm:px-ch">
	{#if data.roster.roster}
		<Roster roster={data.roster.roster} coaches={data.coaches.roster} />
	{:else}
		<Empty>No roster</Empty>
	{/if}

	<TeamSchedule schedule={data.schedule} {team} />
</section>

<style>
	section {
		padding-bottom: max(1ch, env(safe-area-inset-bottom));
	}
</style>
