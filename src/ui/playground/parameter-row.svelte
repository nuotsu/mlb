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
				: undefined,
	)

	let hasPresetOptions = $derived(values.every((value: Docs.EndpointParamProps) => value.label))
	let clearable = $derived(inputType === 'date' && input)
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

	<td class="px-[3px]!" colspan={!hasPresetOptions && !clearable ? 2 : undefined}>
		{#key values}
			<input
				id={parameter}
				name={parameter}
				class={cn(
					'input field-sizing-content w-full min-w-[8ch] px-[.5ch] tabular-nums sm:min-w-[16ch] sm:[[type=date]]:max-w-[10ch]',
					hasPresetOptions && 'max-w-[24ch]',
					!input && '[[type=date]]:text-current/50',
					['custom', 'fields', 'hydrate', 'timecode'].includes(parameter)
						? 'text-left'
						: 'text-center',
				)}
				bind:value={input}
				placeholder={first.value}
				type={inputType}
				min={inputType === 'date' ? '1901-01-01' : undefined}
				max={inputType === 'date' ? `${new Date().getFullYear() + 1}-12-31` : undefined}
				required={parameter === 'custom'}
			/>
		{/key}
	</td>

	{#if hasPresetOptions || clearable}
		<td class="w-full align-middle">
			<div class="flex flex-wrap items-center gap-x-ch">
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

				{#if input}
					<button type="button" class="text-xs text-[red]" onclick={() => (input = '')}>
						Clear
					</button>
				{/if}
			</div>
		</td>
	{/if}
</tr>

<style>
	tr td:nth-child(2):not(:has(+ td)) {
		width: 100%;
	}
</style>
