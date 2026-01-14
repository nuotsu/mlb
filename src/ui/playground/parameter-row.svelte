<script lang="ts">
	import { page } from '$app/state'
	import { cn } from '$lib/utils'
	import { CUSTOM_ENDPOINT_PATH } from './constants'

	let { parameter, values } = $props()

	let form = $derived(page.form)
	let first = $derived(values[0])

	let input = $derived(
		parameter === 'custom'
			? page.url.searchParams.has('endpoint')
				? decodeURIComponent(page.url.searchParams.get('endpoint')!)
				: (form?.entries[parameter] ?? CUSTOM_ENDPOINT_PATH)
			: (form?.entries[parameter] ?? (first.empty ? '' : first.value)),
	)

	let inputType = $derived(
		['date', 'startDate', 'endDate', 'updatedSince'].includes(parameter)
			? 'date'
			: ['season', 'seriesNumber'].includes(parameter)
				? 'number'
				: 'search',
	)

	let hasPresetOptions = $derived(values.every((value: Docs.EndpointParamProps) => value.label))
</script>

<tr class="align-top *:px-[.5ch]">
	<th class="sticky left-0 bg-background text-right font-normal">
		<label for={parameter} class="grid h-lh items-center">
			<small class="flex justify-end font-mono">
				{parameter}
				<span class="text-current/25">=</span>
			</small>
		</label>
	</th>

	<td class="px-[3px]!" colspan={!hasPresetOptions ? 2 : undefined}>
		{#key values}
			<input
				id={parameter}
				name={parameter}
				class={cn(
					'field-sizing-content w-full min-w-[8ch] input px-[.5ch] tabular-nums sm:min-w-[16ch] sm:[[type=date]]:max-w-[10ch]',
					hasPresetOptions && 'max-w-[24ch]',
					!input && '[[type=date]]:text-current/50',
					['custom', 'fields', 'hydrate', 'timecode'].includes(parameter)
						? 'text-left'
						: 'text-center',
				)}
				bind:value={input}
				placeholder={first.value}
				type={inputType}
				required={parameter === 'custom'}
			/>
		{/key}
	</td>

	{#if hasPresetOptions}
		<td class="w-full">
			<div class="flex flex-wrap gap-x-ch">
				{#each values as { value, label }}
					{#if label}
						<label class="whitespace-nowrap">
							<input
								name="{parameter}-presets"
								checked={value === input}
								type="radio"
								onchange={() => (input = value)}
							/>
							{label}
						</label>
					{/if}
				{/each}
			</div>
		</td>
	{/if}
</tr>

<style>
	tr td:nth-child(2):not(:has(+ td)) {
		width: 100%;
	}
</style>
