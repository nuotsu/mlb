<script lang="ts">
	let list = []
</script>

<details class="accordion-base">
	<summary>Favorites</summary>

	{#if list?.length}
		<ul></ul>
	{:else}
		<div class="text-center text-current/40">No favorites</div>
	{/if}
</details>
