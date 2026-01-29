<script lang="ts">
	import Metadata from '$ui/metadata.svelte'
	import TeamSeason from '$ui/schedule/team-season.svelte'
	import Logo from '$ui/team/logo.svelte'
	import Roster from '$ui/team/roster.svelte'
	import type { PageProps } from './$types'

	let { data }: PageProps = $props()

	const team = $derived(data.team as MLB.TeamDetailed)
</script>

<Metadata title="{team.name} | MLB.TheOhtani.com" description="{team.name} team page" />

<header class="flex flex-wrap items-end gap-ch p-ch">
	<Logo class="size-[4lh] shrink-0 rounded-none bg-transparent" {team} />

	<h1 class="grid">
		{#if team.franchiseName !== team.teamName}
			<span>{team.franchiseName}</span>
		{/if}

		<strong class="text-3xl">{team.teamName}</strong>
	</h1>
</header>

<section class="grid gap-lh sm:grid-cols-2">
	{#if data.roster.roster}
		<Roster roster={data.roster.roster} coaches={data.coaches.roster} />
	{/if}

	<TeamSeason schedule={data.schedule} {team} />
</section>
