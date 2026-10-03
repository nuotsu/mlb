<script lang="ts">
	import { cn } from '#lib/utils.js'
	import type { HTMLAttributes } from 'svelte/elements'

	let {
		count,
		class: className,
	}: {
		count?: MLB.Count
	} & HTMLAttributes<HTMLDivElement> = $props()
	let outs = $derived(count?.outs ?? 0)
</script>

<div class="flex items-center justify-center gap-[.25ch] {className}">
	{#each Array.from({ length: 3 }) as _, i (i)}
		<span
			class={cn(
				'inline-block size-[.8lh] rounded-full bg-linear-to-b to-foreground/10 dark:to-foreground/25',
				i < outs && 'bg-red-500',
			)}
		></span>
	{/each}
</div>
