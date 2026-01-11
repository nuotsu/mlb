<script lang="ts">
	import CodeBlock from '$ui/code-block.svelte'
	import type { PageProps } from './$types'
	import { DIRECTORY, HOST, PARAMS } from './constants'

	let { form }: PageProps = $props()

	let endpoint = $derived<string>(form?.endpoint ?? '')

	function parametersToString(parameters?: string[]) {
		return parameters
			?.map((param) => `${param}={${param}}`)
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
								value={[e, parametersToString(endpoints[e].parameters)].filter(Boolean).join('?')}
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
			{#each Object.entries(PARAMS) as [param, values]}
				<tr>
					{#if endpoint.includes(`{${param}}`) || endpoint.includes(`${param}=`)}
						{@const cachedValue = form?.entries[param] ?? values[0].value}

						<td>
							<label for={param}>
								{param}
							</label>
						</td>

						<td>
							<input
								class="text-center tabular-nums"
								id={param}
								name={param}
								value={cachedValue}
								placeholder={values[0].value}
							/>
						</td>

						<td>
							{#each values as { value, label }}
								{#if value}
									<label>
										<input
											type="radio"
											name="{param}-presets"
											data-target={param}
											onchange={(e) => {
												const { target } = (e.target as HTMLInputElement).dataset
												const input = document.querySelector(
													`input[name="${target}"]`,
												)! as HTMLInputElement
												if (input) {
													input.value = value
												}
											}}
											{value}
											checked={value === cachedValue}
										/>
										{label}
									</label>
								{/if}
							{/each}
						</td>
					{/if}
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
