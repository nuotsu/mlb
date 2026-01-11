<script lang="ts">
	import { ENDPOINTS } from './constants'

	let { endpoint, form } = $props()

	let parameters = $derived<Record<string, Docs.EndpointParameterValues[]>>(
		(ENDPOINTS[endpoint.split('?')[0]]?.parameters as Docs.EndpointParameter) ?? {},
	)
</script>

<table class="block max-w-full overflow-x-auto">
	<tbody>
		{#each Object.entries(parameters) as [parameter, values]}
			{@const cachedValue = form?.entries[parameter] ?? values[0]?.value ?? ''}

			<tr class="align-top *:px-[.5ch] *:first:pl-ch">
				<th class="sticky left-0 bg-background text-right font-normal">
					<label for={parameter} class="grid h-lh items-center">
						<small class="flex justify-end font-mono">
							{parameter}
							<span class="text-current/25">=</span>
						</small>
					</label>
				</th>

				<td class="px-[3px]!">
					<input
						class="field-sizing-content w-full max-w-[24ch] min-w-[6ch] input px-[.5ch] text-center tabular-nums"
						id={parameter}
						name={parameter}
						value={cachedValue}
						placeholder={values[0]?.value}
					/>
				</td>

				<td>
					<div class="flex flex-wrap gap-x-ch">
						{#if parameter === 'date'}
							<input
								class="input text-center"
								type="date"
								data-target={parameter}
								value={cachedValue || new Date().toISOString().split('T')[0]}
								onchange={(e) => {
									const { dataset, value } = e.target as HTMLInputElement
									const input = document.querySelector(
										`input[name="${dataset.target}"]`,
									)! as HTMLInputElement
									if (input) {
										input.value = value
									}
								}}
							/>
						{/if}

						{#each values as { value, label }}
							{#if label}
								<label class="whitespace-nowrap">
									<input
										type="radio"
										name="{parameter}-presets"
										checked={value === cachedValue}
										data-target={parameter}
										onchange={(e) => {
											const { target } = (e.target as HTMLInputElement).dataset
											const input = document.querySelector(
												`input[name="${target}"]`,
											)! as HTMLInputElement
											if (input) {
												input.value = value
											}
										}}
									/>
									{label}
								</label>
							{/if}
						{/each}
					</div>
				</td>
			</tr>
		{/each}
	</tbody>
</table>

<style>
	table:has(tbody:empty) {
		display: none;
	}
</style>
