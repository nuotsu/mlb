<script lang="ts">
	import { compareStore } from '#ui/compare/store.svelte.js'
	import { SplitFilledIcon } from '#ui/icons/index.js'
	import Headshot from '#ui/player/headshot.svelte'

	let ids = $derived(compareStore.ids)
</script>

{#if ids.length}
	<a class="flex items-center justify-between gap-ch hover-link" href="/player/compare">
		<div class="flex items-center gap-ch">
			<SplitFilledIcon />
			<span class="sm:sidebar-closed-hidden">Compare ({ids.length})</span>
		</div>

		<div class="flex items-center">
			{#each ids.slice(0, 3) as id (id)}
				<Headshot class="-mr-[.25ch] size-lh shrink-0 anim-fade-to-r" person={{ id }} size={36} />
			{/each}
		</div>
	</a>
{/if}

<style>
	div > :global(img:not(:first-child)) {
		mask: radial-gradient(
			circle calc(0.5lh + 3px) at calc(0.25ch - 0.5lh) center,
			transparent 100%,
			black calc(100% + 0.5px)
		);
	}
</style>
