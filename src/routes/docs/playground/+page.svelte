<script lang="ts">
	import CodeBlock from '$ui/code-block.svelte'
	import type { PageProps } from './$types'
	import { DIRECTORY, ENDPOINTS, HOST } from './constants'

	let { form }: PageProps = $props()

	let endpoint = $derived<string>(form?.endpoint ?? '')
	let parameters = $derived(ENDPOINTS[endpoint.split('?')[0]]?.parameters ?? {})

	function parametersToString(parameters?: Docs.EndpointParameter) {
		return Object.keys(parameters ?? {})
			?.map((key) => `${key}={${key}}`)
			.filter(Boolean)
			.join('&')
	}
</script>

<form class="sticky top-0 z-1 bg-background" method="POST">
	<div class="flex items-stretch gap-ch">
		<button type="submit">Send</button>

		<label class="flex items-baseline">
			<span>{HOST}</span>

			<select class="appearance-none" name="endpoint" bind:value={endpoint}>
				{#each Object.entries(DIRECTORY) as [label, endpoints]}
					<optgroup {label}>
						{#each Object.keys(endpoints) as e}
							<option
								value={[e, parametersToString(endpoints[e]?.parameters)].filter(Boolean).join('?')}
							>
								{e}
							</option>
						{/each}
					</optgroup>
				{/each}
			</select>
		</label>
	</div>

	<table>
		<tbody>
			{#each Object.entries(parameters) as [parameter, values]}
				{@const cachedValue = form?.entries[parameter] ?? values[0]?.value}

				<tr>
					<td>
						{$inspect(values)}
						<label for={parameter}>
							{parameter}
						</label>
					</td>

					<td>
						<input
							class="text-center tabular-nums"
							id={parameter}
							name={parameter}
							value={cachedValue}
						/>
					</td>

					<td>
						{#each values as { value, label }}
							{#if label !== 'Hydrate'}
								<label>
									<input
										type="radio"
										name="{parameter}-presets"
										{value}
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
					</td>
				</tr>
			{/each}
		</tbody>
	</table>

	{#if form}
		<output class="sticky bottom-0 no-scrollbar block overflow-x-auto whitespace-nowrap">
			Endpoint: {form.fetchUrl}
		</output>
	{/if}
</form>

{#if form}
	<CodeBlock
		code={JSON.stringify(form.result, null, 2)}
		lang="json"
		className="text-xs whitespace-pre-wrap"
	/>
{/if}
