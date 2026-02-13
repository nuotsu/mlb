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

<section class="flex flex-col gap-lh pt-lh pb-[max(1lh,env(safe-area-inset-bottom))]">
	<Search class="px-ch" />

	<aside class="order-first space-y-ch text-center">
		<h2 class="text-current/50">Popular Players</h2>

		<div
			class="mx-auto no-scrollbar flex max-w-max items-start gap-ch overflow-auto pr-lh pl-ch max-md:mask-r-from-[calc(100%-2lh)]"
		>
			{#each data.players.people as person (person.id)}
				<a class="flex min-w-[5.5ch] flex-col items-center hover-link" href="/player/{person.id}">
					<Headshot {person} class="size-[2lh]" />
					<span>{person.lastName}</span>
				</a>
			{/each}
		</div>
	</aside>
</section>
