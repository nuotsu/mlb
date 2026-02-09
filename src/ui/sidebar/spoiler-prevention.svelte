<script lang="ts">
	let list = []
</script>

<details class="accordion-base">
	<summary>Spoiler Prevention</summary>

	{#if list?.length}
		<ul></ul>
	{:else}
		<div class="text-center text-current/40">No spoilers</div>
	{/if}
</details>
