<!--
	@component
	An NPB player's photo from npb.jp, as a circle like the MLB `Headshot`: cropped from the top of
	the 4:5 photo, and an empty circle when there's none.
-->
<script lang="ts">
	import { cn } from '#lib/utils.js'

	let { src, class: className }: { src?: string | null; class?: string } = $props()
</script>

{#if src}
	<img
		class={cn(
			'img-fade block shrink-0 rounded-full bg-foreground/10 object-cover object-top text-transparent opacity-0 transition-opacity',
			className,
		)}
		{src}
		width="144"
		height="180"
		alt=""
		loading="lazy"
		decoding="async"
		draggable="false"
		onload={(e) => e.currentTarget.classList.remove('opacity-0')}
	/>
{:else}
	<span class={cn('block shrink-0 rounded-full bg-foreground/10', className)} aria-hidden="true"
	></span>
{/if}
