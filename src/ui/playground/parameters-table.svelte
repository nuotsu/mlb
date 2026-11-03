<script lang="ts">
	import { ENDPOINTS } from './constants'
	import ParameterRow from './parameter-row.svelte'
	import type { ParamValues } from './request'

	let { endpoint, values }: { endpoint: string; values: ParamValues } = $props()

	const config = $derived(ENDPOINTS[endpoint] ?? {})
</script>

<table class="block max-w-full overflow-x-auto py-[.5ch] max-sm:*:block">
	<tbody class="max-sm:block">
		{@render group('pathParams', 'Path params')}
		{@render group('queryParams', 'Query params')}
	</tbody>
</table>

{#snippet group(key: 'pathParams' | 'queryParams', label: string)}
	{@const entries = Object.entries(config[key] ?? {})}

	{#if entries.length}
		<tr class="text-left max-sm:block">
			<th
				class="bg-background text-xs text-current/50 uppercase max-sm:block sm:sticky sm:left-0"
				colspan="2"
			>
				{label}
			</th>
		</tr>
	{/if}

	{#each entries as [parameter, presets] (parameter)}
		<ParameterRow
			{parameter}
			values={presets}
			required={key === 'pathParams'}
			bind:value={values[parameter]}
		/>
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
