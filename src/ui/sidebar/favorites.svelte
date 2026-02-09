<script lang="ts">
	let list: Array<MLB.Team> = []
</script>

<details class="accordion-base" open={!!list?.length}>
	<summary>Favorites</summary>

	{#if list?.length}
		<ul></ul>
	{:else}
		<div class="text-center text-current/40">No favorites</div>
	{/if}
</details>
