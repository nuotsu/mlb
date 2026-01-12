<script lang="ts">
	import { ENDPOINTS } from './constants'
	import ParameterRow from './parameter-row.svelte'

	let { endpoint } = $props()

	let pathParams = $derived<Record<string, Docs.EndpointParamProps[]>>(
		(ENDPOINTS[endpoint.split('?')[0]]?.pathParams as Docs.EndpointParams) ?? {},
	)

	let queryParams = $derived<Record<string, Docs.EndpointParamProps[]>>(
		(ENDPOINTS[endpoint.split('?')[0]]?.queryParams as Docs.EndpointParams) ?? {},
	)
</script>

<table class="block max-w-full overflow-x-auto py-[.5ch]">
	<tbody>
		{@render group('Path params', pathParams)}
		{@render group('Query params', queryParams)}
	</tbody>
</table>

{#snippet group(label: string, params: Record<string, Docs.EndpointParamProps[]>)}
	{@const entries = Object.entries(params)}

	{#if entries.length}
		<tr class="text-left">
			<th class="text-xs font-normal text-current/50 uppercase" colspan="2">
				{label}
			</th>
		</tr>
	{/if}

	{#each entries as [parameter, values]}
		<ParameterRow {parameter} {values} />
	{/each}
{/snippet}

<style>
	table {
		&:has(tbody:empty) {
			display: none;
		}

		:global(tr:has(td) + tr > th:only-child) {
			padding-top: 1lh;
		}
	}
</style>
