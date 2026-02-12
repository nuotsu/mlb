<script lang="ts">
	import { browser } from '$app/environment'
	import { cn } from '$lib/utils'
	import { favoritesStore } from '$ui/favorites/store.svelte'
	import { StarEmptyIcon } from '$ui/icons'
	import Headshot from '$ui/player/headshot.svelte'
	import Logo from '$ui/team/logo.svelte'

	let favorites = $derived(favoritesStore.favorites?.toSorted(sortByType))

	let open = $derived(
		!!favorites?.length && (browser ? localStorage.getItem('sidebar-open') === 'true' : false),
	)

	function sortByType(a: App.Favorite, b: App.Favorite) {
		const aType = a.href.includes('team') ? 0 : 1
		const bType = b.href.includes('team') ? 0 : 1
		return aType - bType
	}
</script>

<details class="accordion-base" bind:open>
	<summary class="hover-link">
		<StarEmptyIcon />
		<span class="sm:sidebar-closed-hidden">Favorites</span>
	</summary>

	{#if favorites?.length}
		<ul class="grid grid-cols-2 gap-px text-center sm:sidebar-closed-hidden">
			{#each favorites as favorite (favorite.href)}
				{@const id = Number(favorite.href.split('/').pop())}
				{@const isTeam = favorite.href.includes('team')}

				<li class="anim-fade-to-r">
					<a
						class={cn(
							'group/fav relative flex w-full items-center gap-[.5ch] bg-current/5 p-[.25ch]',
							isTeam && 'before:opacity-10',
						)}
						href={favorite.href}
						style:--team-bg={isTeam
							? `url(https://midfield.mlbstatic.com/v1/team/${id}/spots/32)`
							: undefined}
					>
						{#if isTeam}
							<Logo class="size-lh" team={{ id } as MLB.Team} />
						{:else if favorite.href.includes('player')}
							<Headshot class="size-lh shrink-0" person={{ id }} size={36} />
						{/if}

						<span class="grow truncate decoration-dashed group-hover/fav:underline">
							{favorite.label}
						</span>
					</a>
				</li>
			{/each}
		</ul>
	{:else}
		<div class="text-center text-current/40">No favorites</div>
	{/if}
</details>
