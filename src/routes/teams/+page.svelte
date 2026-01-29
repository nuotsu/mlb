<script lang="ts">
	import Metadata from '$ui/metadata.svelte'
	import Logo from '$ui/team/logo.svelte'
	import type { PageProps } from './$types'

	let { data }: PageProps = $props()

	const { sport } = $derived(data.teams.teams[0] as MLB.TeamDetailed)
</script>

<Metadata
	title="{sport?.abbreviation || 'MLB'} Teams | MLB.TheOhtani.com"
	description="List of all {sport?.name || 'MLB'} teams"
/>

<section class="space-y-lh p-ch">
	<header class="text-center">
		<h1>{sport?.abbreviation || 'MLB'} Teams</h1>
	</header>

	<ul>
		{#each data.teams.teams.sort((a, b) => a.name.localeCompare(b.name)) as team}
			<li>
				<a
					class="flex items-center gap-ch decoration-dashed hover:underline"
					href="/teams/{team.id}"
				>
					<Logo class="size-lh" {team} />
					{team.name}
				</a>
			</li>
		{/each}
	</ul>
</section>
