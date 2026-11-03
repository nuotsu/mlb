<script lang="ts">
	let { lines = 18 }: { lines?: number } = $props()

	// Deterministic widths so SSR and the client agree
	const widths = $derived(Array.from({ length: lines }, (_, i) => 20 + ((i * 37) % 55)))
</script>

<div
	class="skeleton min-h-0 flex-1 overflow-hidden p-ch"
	aria-busy="true"
	aria-label="Loading response"
>
	{#each widths as width, i}
		<div class="line" style:width={`${width}%`} style:margin-left={`${(i % 4) * 2}ch`}></div>
	{/each}
</div>

<style>
	.skeleton {
		display: grid;
		align-content: start;
		gap: 8px;
	}

	.line {
		height: 12px;
		max-width: calc(100% - 8ch);
		border-radius: 2px;
		background: rgb(240 243 246 / 0.08);
		animation: pulse 1.2s ease-in-out infinite alternate;
	}

	@keyframes pulse {
		to {
			background: rgb(240 243 246 / 0.16);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.line {
			animation: none;
		}
	}
</style>
