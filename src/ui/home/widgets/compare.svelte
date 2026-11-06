<script lang="ts">
	import { compareStore } from '#ui/compare/store.svelte.js'
	import Headshot from '#ui/player/headshot.svelte'
	import { onMount } from 'svelte'
	import Widget from '../widget.svelte'
	import type { WidgetData } from './index.js'
	import { fetchPeople } from './people.js'

	let {}: { data: WidgetData } = $props()

	let mounted = $state(false)
	onMount(() => (mounted = true))

	const ids = $derived(mounted ? compareStore.ids : [])
</script>

<Widget title="Compare" href="/player/compare" linkLabel="Open">
	{#if ids.length}
		<a class="group/c grid gap-ch" href="/player/compare">
			<span class="flex">
				{#each ids.slice(0, 6) as id (id)}
					<Headshot
						class="-mr-[.75ch] size-[2lh] shrink-0 ring-2 ring-background"
						person={{ id }}
						size={96}
					/>
				{/each}
			</span>
			{#await fetchPeople(ids) then people}
				<span class="line-clamp-2 text-sm group-hover/c:underline">
					{people.map((p) => p.fullName).join(', ')}
				</span>
			{/await}
		</a>
	{:else}
		<p class="text-sm text-current/60">
			Add players from their pages to compare their stats side by side.
		</p>
	{/if}
</Widget>
