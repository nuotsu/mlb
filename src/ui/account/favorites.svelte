<script lang="ts">
	import { favoritesStore } from '#ui/favorites/store.svelte.js'
	import { onMount } from 'svelte'
	import Chip from './chip.svelte'

	// Favorites live in localStorage; swap them in after hydration
	let mounted = $state(false)
	onMount(() => (mounted = true))

	let favorites = $derived(mounted ? favoritesStore.favorites : [])
	let groups = $derived(
		[
			{ label: 'Teams', items: favorites.filter(isTeam) },
			{ label: 'Players', items: favorites.filter((f) => !isTeam(f)) },
		].filter((g) => g.items.length),
	)

	function isTeam(favorite: App.Favorite) {
		return favorite.href.startsWith('/teams/')
	}

	function idOf(favorite: App.Favorite) {
		return Number(favorite.href.split('/').pop())
	}
</script>

<section class="space-y-ch">
	<header class="flex items-baseline justify-between gap-ch">
		<h2 class="h3">Favorites</h2>
		{#if favorites.length}
			<small class="text-xs text-current/60 tabular-nums">{favorites.length}</small>
		{/if}
	</header>

	{#each groups as group (group.label)}
		<div class="space-y-[.5ch]">
			<h3 class="text-[x-small] tracking-widest text-current/50 uppercase">{group.label}</h3>
			<ul class="flex flex-wrap gap-[.5ch]">
				{#each group.items as favorite (favorite.href)}
					{@const team = isTeam(favorite)}
					<Chip
						href={favorite.href}
						label={favorite.label}
						teamId={team ? idOf(favorite) : undefined}
						personId={team ? undefined : idOf(favorite)}
						removeLabel="Remove {favorite.label} from favorites"
						onremove={() => favoritesStore.remove(favorite)}
					/>
				{/each}
			</ul>
		</div>
	{:else}
		<p class="text-sm text-current/60">
			Star a <a class="link" href="/teams">team</a> or <a class="link" href="/player">player</a> to keep
			them one tap away. Favorite teams' games are listed first on the schedule.
		</p>
	{/each}
</section>
