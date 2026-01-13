<script lang="ts">
	import { page } from '$app/state'
	import { cn } from '$lib/utils'

	let { parameter, values } = $props()

	let form = $derived(page.form)
	let first = $derived(values[0])

	let input = $derived(
		parameter === 'custom'
			? (page.url.searchParams.get('endpoint') ?? '/api/v1/')
			: (form?.entries[parameter] ?? (first.empty ? '' : first.value)),
	)

	let inputType = $derived(
		['date', 'updatedSince'].includes(parameter)
			? 'date'
			: ['season'].includes(parameter)
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
					'field-sizing-content w-full min-w-[8ch] input px-[.5ch] tabular-nums sm:min-w-[16ch]',
					hasPresetOptions && 'max-w-[24ch] text-center',
					!input && '[[type=date]]:text-current/50',
				)}
				bind:value={input}
				placeholder={first.value}
				type={inputType}
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
