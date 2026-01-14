<script lang="ts">
	import { ENDPOINTS } from './constants'
	import ParameterRow from './parameter-row.svelte'

	let { endpoint } = $props()
</script>

<table class="block max-w-full overflow-x-auto py-[.5ch]">
	<tbody>
		{@render group('pathParams', 'Path params')}
		{@render group('queryParams', 'Query params')}
	</tbody>
</table>

{#snippet group(key: string, label: string)}
	{@const entries = Object.entries(ENDPOINTS[endpoint.split('?')[0]][key] ?? {})}

	{#if entries.length}
		<tr class="text-left">
			<th
				class="sticky left-0 bg-background text-xs font-normal text-current/50 uppercase"
				colspan="2"
			>
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
