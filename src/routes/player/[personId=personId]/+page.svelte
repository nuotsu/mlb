<script lang="ts">
	import Metadata from '$ui/metadata.svelte'
	import Headshot from '$ui/player/headshot.svelte'
	import type { PageProps } from './$types'

	let { data }: PageProps = $props()
	let player = $derived(data.person)

	$inspect(player)
</script>

<Metadata title="{player.fullName} | MLB.TheOhtani.com" description="{player.fullName} profile" />

<section class="p-ch">
	<h1>
		{player.fullName}

		{#if player.primaryNumber}
			#{player.primaryNumber}
		{/if}
	</h1>

	<Headshot class="rounded-none bg-transparent" person={player} size={120} type="silo" />

	<!-- <img
		src="https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:action:hero:current.jpg/w_426,q_auto:best/v1/people/{player.id}/action/hero/current"
		alt=""
	/> -->
</section>
