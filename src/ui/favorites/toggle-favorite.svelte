<script lang="ts">
	import { dev } from '$app/environment'
	import { favoritesStore } from '$ui/favorites/store.svelte'
	import { StarEmptyIcon, StarIcon } from '$ui/icons'
	import posthog from 'posthog-js'
	import type { HTMLAttributes } from 'svelte/elements'

	let {
		target,
		class: className,
		children,
	}: {
		target: App.Favorite
	} & HTMLAttributes<HTMLInputElement> = $props()

	let checked = $derived(favoritesStore.has(target.href))

	function toggle() {
		favoritesStore.toggle(target)

		if (!checked && !dev) {
			posthog.capture('favorite_added', { href: target.href })
		}
	}
</script>

<label
	class="group/fav inline-flex items-center justify-center gap-[.5ch] text-current/50 transition-colors *:size-lh has-checked:text-accent {className}"
	title="Toggle favorite"
>
	<input
		class="sr-only"
		type="checkbox"
		value={target.href}
		{checked}
		onchange={toggle}
	/>

	<StarEmptyIcon class="group-has-checked/fav:hidden" />
	<StarIcon class=" group-not-has-checked/fav:hidden" />

	{@render children?.()}
</label>
