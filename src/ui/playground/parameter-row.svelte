<script lang="ts">
	import { cn } from '#lib/utils.js'
	import type { ParamValues } from './request'

	let {
		parameter,
		values,
		value = $bindable(''),
		required = false,
	}: {
		parameter: string
		values: Docs.EndpointParamProps[]
		/** A number (or null) when bound to `<input type=number>` */
		value?: ParamValues[string]
		/** Path params: the request can't be built without them */
		required?: boolean
	} = $props()

	let first = $derived(values[0])

	let inputType = $derived(
		['date', 'startDate', 'endDate', 'updatedSince'].includes(parameter)
			? 'date'
			: ['season', 'seriesNumber', 'limit', 'offset'].includes(parameter)
				? 'number'
				: undefined,
	)

	let hasPresetOptions = $derived(values.every((v: Docs.EndpointParamProps) => v.label))
	let clearable = $derived(inputType === 'date' && value)
	/** Free-text params read better left-aligned */
	let wide = $derived(
		parameter === 'custom' ||
			['fields', 'hydrate', 'Timecode', 'timecode', 'Ids', 'names'].some((s) =>
				parameter.includes(s),
			),
	)
</script>

<tr
	class="align-top max-sm:grid max-sm:grid-cols-1 max-sm:gap-y-[.5ch] max-sm:py-[.5ch] sm:*:px-[.5ch]"
>
	<th class="bg-background text-right max-sm:text-left sm:sticky sm:left-0">
		<label for={parameter} class="grid items-center sm:h-lh">
			<small class="flex font-mono tabular-nums sm:justify-end">
				{parameter}
				{#if required}
					<abbr class="text-accent no-underline" title="required">*</abbr>
				{/if}
				<span class="text-current/25 max-sm:hidden">=</span>
			</small>
		</label>
	</th>

	<td class="px-[3px]!" colspan={!hasPresetOptions && !clearable ? 2 : undefined}>
		{#key values}
			<input
				id={parameter}
				name={parameter}
				class={cn(
					'input-dev w-full px-[.5ch] tabular-nums max-sm:h-11 max-sm:text-base sm:field-sizing-content sm:min-w-[16ch] sm:[[type=date]]:max-w-[10ch]',
					hasPresetOptions && 'sm:max-w-[24ch]',
					!value && '[[type=date]]:text-current/50',
					wide ? 'text-left' : 'sm:text-center',
				)}
				bind:value
				placeholder={first.value || first.placeholder}
				type={inputType}
				min={inputType === 'date' ? '1901-01-01' : undefined}
				max={inputType === 'date' ? `${new Date().getFullYear() + 1}-12-31` : undefined}
				{required}
				aria-required={required}
				autocomplete="off"
				autocapitalize="off"
				spellcheck="false"
			/>
		{/key}
	</td>

	{#if hasPresetOptions || clearable}
		<td class="w-full align-middle">
			<div class="flex flex-wrap items-center gap-x-ch max-sm:gap-y-[.25ch]">
				{#each values as preset}
					{#if preset.label}
						<label class="inline-flex items-center gap-[.5ch] whitespace-nowrap max-sm:min-h-9">
							<input
								name="{parameter}-presets"
								checked={preset.value === String(value ?? '')}
								type="radio"
								onchange={() => (value = preset.value)}
							/>
							{preset.label}
						</label>
					{/if}
				{/each}

				{#if value}
					<button
						type="button"
						class="text-xs text-[red] max-sm:min-h-9 max-sm:px-ch"
						onclick={() => (value = '')}
					>
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
