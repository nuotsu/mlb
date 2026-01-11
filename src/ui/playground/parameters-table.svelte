<script lang="ts">
	import { ENDPOINTS } from './constants'

	let { endpoint, form } = $props()

	let parameters = $derived<Record<string, Docs.EndpointParameterValues[]>>(
		(ENDPOINTS[endpoint.split('?')[0]]?.parameters as Docs.EndpointParameter) ?? {},
	)
</script>

<table class="block max-w-full overflow-x-auto px-ch">
	<tbody>
		{#each Object.entries(parameters) as [parameter, values]}
			{@const cachedValue = form?.entries[parameter] ?? values[0]?.value ?? ''}

			<tr>
				<td>
					<label for={parameter}>
						{parameter}
					</label>
				</td>

				<td>
					<input
						class="field-sizing-content w-full min-w-[4ch] px-ch text-center tabular-nums"
						id={parameter}
						name={parameter}
						value={cachedValue}
						placeholder={values[0]?.value}
					/>
				</td>

				<td>
					<div class="flex flex-wrap gap-x-ch">
						{#each values as { value, label }}
							{#if label !== 'Hydrate'}
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
