<script lang="ts">
	import { page } from '$app/state'
	import { ENDPOINTS } from './constants'
	import ParameterRow from './parameter-row.svelte'

	let { endpoint } = $props()

	let parameters = $derived<Record<string, Docs.EndpointParameterProps[]>>(
		(ENDPOINTS[endpoint.split('?')[0]]?.parameters as Docs.EndpointParameter) ?? {},
	)
</script>

<table class="block max-w-full overflow-x-auto py-[.5ch]">
	<tbody>
		{#each Object.entries(parameters) as [parameter, values]}
			<ParameterRow {parameter} {values} />
		{/each}
	</tbody>
</table>

<style>
	table:has(tbody:empty) {
		display: none;
	}
</style>
