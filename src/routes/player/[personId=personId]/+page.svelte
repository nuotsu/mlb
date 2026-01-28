<script lang="ts">
	import Metadata from '$ui/metadata.svelte'
	import Headshot from '$ui/player/headshot.svelte'
	import type { PageProps } from './$types'

	let { data }: PageProps = $props()
	let player = $derived(data.person)
</script>

<Metadata title="{player.fullName} | MLB.TheOhtani.com" description="{player.fullName} profile" />

<section class="p-ch">
	<header class="flex flex-wrap items-end gap-ch">
		<Headshot
			class="size-[4lh] shrink-0 rounded-none bg-transparent"
			person={player}
			size={240}
			type="silo"
		/>

		<h1 class="grid">
			<span>{player.useName || player.firstName}</span>
			<strong class="text-3xl">{player.useLastName || player.lastName}</strong>
		</h1>

		{#if player.primaryNumber}
			<div>
				#{player.primaryNumber}
			</div>
		{/if}

		{#if player.primaryPosition}
			<div>
				{player.primaryPosition.abbreviation}
			</div>
		{/if}
	</header>

	<!-- <img
		src="https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:action:hero:current.jpg/w_426,q_auto:best/v1/people/{player.id}/action/hero/current"
		alt=""
	/> -->
</section>
