<script lang="ts">
	import { accountStore } from '#ui/account/store.svelte.js'
	import { favoritesStore } from '#ui/favorites/store.svelte.js'
	import Headshot from '#ui/player/headshot.svelte'
	import TeamAvatar from '#ui/team/avatar.svelte'
	import { onMount } from 'svelte'
	import Widget from '../widget.svelte'
	import type { WidgetData } from './index.js'
	import { fetchPeople } from './people.js'

	let {}: { data: WidgetData } = $props()

	let mounted = $state(false)
	onMount(() => (mounted = true))

	const ids = $derived(
		mounted
			? favoritesStore.favorites
					.filter((f) => f.href.startsWith('/player/'))
					.map((f) => Number(f.href.split('/').pop()))
			: [],
	)
</script>

<Widget title="Your players" href="/account" linkLabel="Favorites">
	{#if ids.length}
		{#await fetchPeople(ids)}
			{@render skeleton(Math.min(ids.length, 4))}
		{:then people}
			<ul class="grid gap-[.5ch] sm:grid-cols-[repeat(auto-fill,minmax(14rem,1fr))]">
				{#each people as person (person.id)}
					<li>
						<a class="group/p flex items-center gap-ch" href="/player/{person.id}">
							<Headshot
								class="size-[2lh] shrink-0"
								person={{ id: person.id, fullName: person.fullName }}
								size={96}
							/>
							<span class="min-w-0">
								<span class="block truncate group-hover/p:underline">{person.fullName}</span>
								<span class="flex items-center gap-[.5ch] text-xs text-current/60">
									{#if person.currentTeam}
										<span class="contents" title={person.currentTeam.name}>
											<TeamAvatar class="size-[1.25em]" teamId={person.currentTeam.id} />
											<span class="sr-only">{person.currentTeam.name}</span>
										</span>
									{/if}
									{person.primaryPosition?.abbreviation}
								</span>
							</span>
						</a>
					</li>
				{/each}
			</ul>
		{:catch}
			<p class="text-sm text-current/60">Couldn't load your players.</p>
		{/await}
	{:else if mounted}
		<div class="grid gap-ch text-sm text-current/60">
			<p>
				<a class="link" href="/player">Find a player</a> and tap the star to keep them one tap away here.
			</p>
			{#if accountStore.enabled && !accountStore.user}
				<p class="text-xs">Sign in to see them on every device.</p>
			{/if}
		</div>
	{:else}
		{@render skeleton(2)}
	{/if}
</Widget>

{#snippet skeleton(count: number)}
	<ul class="grid gap-[.5ch]" aria-hidden="true">
		{#each { length: count }, i (i)}
			<li class="flex items-center gap-ch">
				<span class="size-[2lh] shrink-0 animate-pulse rounded-full bg-current/10"></span>
				<span class="h-[1lh] w-[16ch] animate-pulse bg-current/10"></span>
			</li>
		{/each}
	</ul>
{/snippet}
