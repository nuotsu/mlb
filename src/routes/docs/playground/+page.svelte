<script lang="ts">
	import CodeBlock from '$ui/code-block.svelte'
	import type { PageProps } from './$types'
	import { DIRECTORY, HOST, PARAMS } from './constants'

	let { form }: PageProps = $props()

	// let endpoint = $state<string>(Object.keys(DIRECTORY[Object.keys(DIRECTORY)[0]])[0])
	let endpoint = $state<string>('')
</script>

<form method="POST">
	<label class="flex items-start">
		<span>{HOST}</span>

		<select name="endpoint" bind:value={endpoint}>
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
		{#each Object.entries(PARAMS) as [param, value]}
			{#if endpoint.includes(`{${param}}`)}
				<label>
					{param}:
					<input name={param} {value} />
				</label>
			{/if}
		{/each}
	</div>

	<button type="submit">Send</button>
</form>

{#if form}
	<output>{HOST + form.endpoint}</output>

	<CodeBlock
		code={JSON.stringify(form.result, null, 2)}
		lang="json"
		className="whitespace-pre-wrap"
	/>
{/if}
