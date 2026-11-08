<!--
	@component
	A KBO player's name, in Korean as koreabaseball.com has it, linking to their page there when
	their ID is known (from the day's game list or the team's register).
-->
<script lang="ts">
	import type { KboPlayerRef } from '#lib/kbo-game.js'
	import { kboPlayerUrl } from '#lib/kbo.js'
	import { cn } from '#lib/utils.js'
	import type { Snippet } from 'svelte'

	let {
		player,
		pitcher = false,
		class: className,
		tabindex,
		children,
	}: {
		player: KboPlayerRef
		/** Links the pitcher's record page rather than the hitter's */
		pitcher?: boolean
		class?: string
		tabindex?: number
		children?: Snippet
	} = $props()
</script>

<svelte:element
	this={player.id ? 'a' : 'span'}
	class={cn(player.id && 'decoration-dashed hover:underline', className)}
	href={player.id ? kboPlayerUrl(player.id, pitcher) : undefined}
	target={player.id ? '_blank' : undefined}
	rel={player.id ? 'noopener noreferrer' : undefined}
	title={player.nameKo}
	{tabindex}
	lang="ko"
>
	{#if children}{@render children()}{:else}{player.nameKo}{/if}
</svelte:element>
