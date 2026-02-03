<script lang="ts">
	import Metadata from '$ui/metadata.svelte'
	import Headshot from '$ui/player/headshot.svelte'
	import GraphList from '$ui/stats/graph-list.svelte'
	import StyledTeam from '$ui/team/styled-team.svelte'
	import type { PageProps } from './$types'

	let { data }: PageProps = $props()

	let person = $derived(
		data.person as MLB.Person & {
			currentTeam: MLB.Team
			preferredTeam?: { team: MLB.Team }
			stats: MLB.PlayerStats[]
		},
	)

	const team = $derived(person.active ? person.currentTeam : person.preferredTeam?.team)
</script>

<Metadata title="{person.fullName} | MLB.TheOhtani.com" description="{person.fullName} profile" />

<section class="p-ch">
	<header class="flex flex-wrap items-end gap-ch">
		<Headshot
			class="size-[4lh] shrink-0 rounded-none bg-transparent"
			{person}
			size={240}
			type={person.active ? 'silo' : 'spots'}
		/>

		<h1 class="grid">
			<span>{person.useName || person.firstName}</span>
			<strong class="text-3xl">{person.useLastName || person.lastName}</strong>
		</h1>

		{#if person.primaryNumber}
			<div>
				#{person.primaryNumber}
			</div>
		{/if}

		{#if person.primaryPosition}
			<div>
				{person.primaryPosition.abbreviation}
			</div>
		{/if}
	</header>

	{#if team}
		<StyledTeam {team} linked />
	{/if}

	<!-- <img
		src="https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:action:hero:current.jpg/w_426,q_auto:best/v1/people/{person.id}/action/hero/current"
		alt=""
	/> -->

	<GraphList {person} />
</section>
