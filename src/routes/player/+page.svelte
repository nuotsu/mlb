<script lang="ts">
	import Header from '$ui/header.svelte'
	import Metadata from '$ui/metadata.svelte'
	import Headshot from '$ui/player/headshot.svelte'
	import Search from '$ui/player/search.svelte'
	import type { PageProps } from './$types'

	let { data }: PageProps = $props()

	$inspect(data.players.people)
</script>

<Metadata title="Player Directory | MLB.TheOhtani.com" description="Search for a player by name" />

<Header title="Player Directory" crumbs={[{ href: '/player', name: 'Players' }]} />

<section class="flex flex-col gap-lh py-lh">
	<Search class="px-ch" />

	<aside class="order-first space-y-ch text-center">
		<h2 class="text-current/50">Popular Players</h2>

		<div
			class="mx-auto grid max-w-max auto-cols-fr grid-flow-col items-start gap-ch overflow-auto px-ch"
		>
			{#each data.players.people as person (person.id)}
				<a class="flex shrink-0 flex-col items-center hover-link" href="/player/{person.id}">
					<Headshot {person} class="size-[2lh]" />
					<span>{person.lastName}</span>
				</a>
			{/each}
		</div>
	</aside>
</section>
