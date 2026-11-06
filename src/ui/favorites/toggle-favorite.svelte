<script lang="ts">
	import { trackFavorite } from '#ui/analytics.js'
	import { favoritesStore } from '#ui/favorites/store.svelte.js'
	import { StarEmptyIcon, StarIcon } from '#ui/icons/index.js'
	import { page } from '$app/state'
	import type { HTMLAttributes } from 'svelte/elements'

	let {
		target,
		class: className,
		children,
	}: { target: App.Favorite } & HTMLAttributes<HTMLInputElement> = $props()
	let checked = $derived(favoritesStore.has(target.href))

	function toggle() {
		const action = checked ? 'remove' : 'add'
		favoritesStore.toggle(target)
		trackFavorite(action, target, page.route.id ?? 'unknown', favoritesStore.favorites)
	}
</script>

<label
	class="group/fav inline-flex items-center justify-center gap-[.5ch] text-current/50 transition-colors *:size-lh has-checked:text-accent {className}"
	title="Toggle favorite"
>
	<input class="sr-only" type="checkbox" value={target.href} {checked} onchange={toggle} />

	<StarEmptyIcon class="group-has-checked/fav:hidden" />
	<StarIcon class=" group-not-has-checked/fav:hidden" />

	{@render children?.()}
</label>
