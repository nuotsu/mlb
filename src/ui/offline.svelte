<script lang="ts">
	let online = $state(true)
</script>

<svelte:window onoffline={() => (online = false)} ononline={() => (online = true)} />

{#if !online}
	<aside class="w-full bg-amber-500 p-ch text-center text-sm text-black">
		Offline — showing cached data
	</aside>
{/if}
