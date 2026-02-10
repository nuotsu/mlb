<script lang="ts">
	import { StarEmptyIcon, StarIcon } from '$ui/icons'
	import { favoritesStore } from '$ui/store.svelte'

	let {
		target,
	}: {
		target: App.Favorite
	} = $props()

	let checked = $derived(favoritesStore.has(target))
</script>

<label
	class="group/fav text-current/50 transition-colors *:size-lh has-checked:text-accent"
	title="Toggle favorite"
>
	<input
		class="sr-only"
		type="checkbox"
		value={target.href}
		{checked}
		onchange={() => favoritesStore.toggle(target)}
	/>

	<StarEmptyIcon class=" group-has-checked/fav:hidden" />
	<StarIcon class=" group-not-has-checked/fav:hidden" />
</label>
