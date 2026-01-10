<script lang="ts">
	import CodeBlock from '$ui/code-block.svelte'
	import type { PageProps } from './$types'
	import { DIRECTORY, HOST, PARAMS } from './constants'

	let { form }: PageProps = $props()

	let endpoint = $derived<string>(form?.endpoint ?? '')
</script>

<form method="POST">
	<label class="flex items-baseline">
		<span>{HOST}</span>

		<select class="appearance-none" name="endpoint" bind:value={endpoint}>
			{#each Object.entries(DIRECTORY) as [label, endpoints]}
				<optgroup {label}>
					{#each Object.keys(endpoints) as e}
						<option value={e}>{e}</option>
					{/each}
				</optgroup>
			{/each}
		</select>
	</label>

	<div>
		{#each Object.entries(PARAMS) as [param, values]}
			{#if endpoint.includes(`{${param}}`)}
				{@const cachedValue = form?.entries[param] ?? values[0].value}

				<label>
					{param}:
					<input name={param} value={cachedValue} placeholder={values[0].value} />
				</label>

				{#each values as { value, label }}
					<label>
						<input
							type="radio"
							name="{param}-presets"
							data-target={param}
							onchange={(e) => {
								const { target } = (e.target as HTMLInputElement).dataset
								const input = document.querySelector(`input[name="${target}"]`)! as HTMLInputElement
								if (input) {
									input.value = value
								}
							}}
							{value}
							checked={value === cachedValue}
						/>
						{label}
					</label>
				{/each}
			{/if}
		{/each}
	</div>

	<button type="submit">Send</button>
</form>

{#if form}
	<output>{HOST + form.fetchUrl}</output>

	<CodeBlock
		code={JSON.stringify(form.result, null, 2)}
		lang="json"
		className="text-xs whitespace-pre-wrap"
	/>
{/if}
