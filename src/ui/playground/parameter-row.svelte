<script lang="ts">
	import { page } from '$app/state'

	let { parameter, values } = $props()

	let form = $derived(page.form)

	let input = $derived(form?.entries[parameter] ?? values[0]?.value ?? '')
	let isDateInput = $derived(['date', 'updatedSince'].includes(parameter))

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
		<input
			id={parameter}
			name={parameter}
			class="field-sizing-content w-full min-w-[8ch] input px-[.5ch] tabular-nums sm:min-w-[12ch] {hasPresetOptions
				? 'max-w-[24ch] text-center'
				: ''}"
			bind:value={input}
			placeholder={values[0]?.value}
			type={isDateInput ? 'date' : 'search'}
		/>
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
