<script lang="ts">
	import { favoritesStore } from '$ui/store.svelte'

	let list = $derived(favoritesStore.favorites)
</script>

<details class="accordion-base" open={!!list?.length}>
	<summary>Favorites</summary>

	{#if list?.length}
		<ul>
			{#each list as favorite (favorite.href)}
				<li>
					<a href={favorite.href}>{favorite.label}</a>
				</li>
			{/each}
		</ul>
	{:else}
		<div class="text-center text-current/40">No favorites</div>
	{/if}
</details>
