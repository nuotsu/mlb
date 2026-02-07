<script lang="ts">
	import { ENDPOINTS } from './constants'
	import ParameterRow from './parameter-row.svelte'

	let {
		endpoint,
		initialParams = {},
	}: { endpoint: string; initialParams?: Record<string, string> } = $props()

	const config = $derived(ENDPOINTS[endpoint.split('?')[0]])
</script>

<table class="block max-w-full overflow-x-auto py-[.5ch]">
	<tbody>
		{@render group('pathParams', 'Path params')}
		{@render group('queryParams', 'Query params')}
	</tbody>
</table>

{#snippet group(key: keyof typeof config, label: string)}
	{@const entries = Object.entries(config[key] ?? {})}

	{#if entries.length}
		<tr class="text-left">
			<th class="sticky left-0 bg-background text-xs text-current/50 uppercase" colspan="2">
				{label}
			</th>
		</tr>
	{/if}

	{#each entries as [parameter, values]}
		<ParameterRow {parameter} {values} initialValue={initialParams[parameter]} />
	{/each}
{/snippet}

<style>
	table {
		&:not(:has(tbody tr)) {
			display: none;
		}

		:global(tr:has(td) + tr > th:only-child) {
			padding-top: 1lh;
		}
	}
</style>
