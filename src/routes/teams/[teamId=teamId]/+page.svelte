<script lang="ts">
	import Metadata from '$ui/metadata.svelte'
	import type { PageProps } from './$types'

	let { data }: PageProps = $props()

	const team = $derived(data.team as MLB.TeamDetailed)

	$inspect(team)
</script>

<Metadata title="{team.name} | MLB.TheOhtani.com" description="{team.name} team page" />

<section class="p-ch">
	<h1>{team.name}</h1>
</section>
