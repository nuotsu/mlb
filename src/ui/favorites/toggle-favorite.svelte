<script lang="ts">
	import { browser, dev } from '$app/environment'
	import { requestPermission, scheduleForToday } from '$lib/notifications'
	import { favoritesStore } from '$ui/favorites/store.svelte'
	import { StarEmptyIcon, StarIcon } from '$ui/icons'
	import posthog from 'posthog-js'

	let {
		target,
	}: {
		target: App.Favorite
	} = $props()

	let checked = $derived(favoritesStore.has(target.href))
	const isTeam = target.href.startsWith('/teams/')

	async function toggle() {
		const isAdding = !checked
		favoritesStore.toggle(target)

		if (isAdding && !dev) {
			posthog.capture('favorite_added', { href: target.href })
		}

		if (isAdding && isTeam && browser && 'Notification' in window) {
			if (Notification.permission === 'default') {
				await requestPermission()
			}
			if (Notification.permission === 'granted') {
				await scheduleForToday(favoritesStore.favorites)
			}
		}
	}
</script>

<label
	class="group/fav text-current/50 transition-colors *:size-lh has-checked:text-accent"
	title="Toggle favorite"
>
	<input class="sr-only" type="checkbox" value={target.href} {checked} onchange={toggle} />

	<StarEmptyIcon class="group-has-checked/fav:hidden" />
	<StarIcon class=" group-not-has-checked/fav:hidden" />
</label>
