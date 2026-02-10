<script lang="ts">
	let list: Array<number> = []
</script>

<details class="accordion-base" open={!!list?.length}>
	<summary>Spoiler Prevention</summary>

	{#if list?.length}
		<ul></ul>
	{:else}
		<div class="text-center text-current/40">No spoiler prevention</div>
	{/if}
</details>
