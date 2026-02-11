<script lang="ts">
	import { cn } from '$lib/utils'
	import { favoritesStore } from '$ui/favorites/store.svelte'
	import Headshot from '$ui/player/headshot.svelte'
	import Logo from '$ui/team/logo.svelte'

	function sortByType(a: App.Favorite, b: App.Favorite) {
		const aType = a.href.includes('team') ? 0 : 1
		const bType = b.href.includes('team') ? 0 : 1
		return aType - bType
	}
</script>

<details class="accordion-base" open={!!favoritesStore.favorites?.length}>
	<summary class="hover-link">Favorites</summary>

	{#if favoritesStore.favorites?.length}
		<ul class="grid grid-cols-2 gap-px text-center">
			{#each favoritesStore.favorites.sort(sortByType) as favorite (favorite.href)}
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

						<span class="line-clamp-1 grow break-all decoration-dashed group-hover/fav:underline">
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
