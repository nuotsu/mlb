<script lang="ts">
	let { className }: { className?: string } = $props()
</script>

<div class="grid min-w-max rotate-45 grid-cols-2 gap-[.5ch] {className}">
	{#each [1, 0, 2] as base (base)}
		<div class="aspect-square size-[1.25lh] border border-current/25"></div>
	{/each}
</div>
