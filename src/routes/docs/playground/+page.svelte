<script lang="ts">
	import CodeBlock from '$ui/code-block.svelte'
	import EndpointSelect from '$ui/playground/endpoint-select.svelte'
	import ParametersTable from '$ui/playground/parameters-table.svelte'
	import type { PageProps } from './$types'

	let { form }: PageProps = $props()

	let endpoint = $derived(form?.endpoint ?? '')
</script>

<form class="top-0 z-1 bg-background md:sticky" method="POST">
	<div class="flex flex-wrap items-stretch max-md:flex-col">
		<EndpointSelect bind:value={endpoint} />
		<button class="action max-md:grow md:order-first" type="submit">Send</button>
	</div>

	<ParametersTable {endpoint} {form} />
</form>

{#if form}
	<CodeBlock
		code={JSON.stringify(form.result, null, 2)}
		lang="json"
		pre={form.fetchUrl}
		className="text-xs whitespace-pre-wrap"
	/>
{/if}
