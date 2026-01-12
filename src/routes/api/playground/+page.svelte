<script lang="ts">
	import CodeBlock from '$ui/code-block.svelte'
	import EndpointSelect from '$ui/playground/endpoint-select.svelte'
	import ParametersTable from '$ui/playground/parameters-table.svelte'
	import type { PageProps } from './$types'

	let { form }: PageProps = $props()

	let endpoint = $derived(form?.endpoint ?? '')
</script>

<section class="top-0 z-1 bg-background sm:sticky">
	<form class="space-ch mx-auto grid max-w-5xl gap-ch p-ch" method="POST">
		<div class="flex flex-wrap items-stretch max-sm:flex-col">
			<EndpointSelect bind:value={endpoint} />

			<button class="action max-sm:grow max-sm:active:scale-95 sm:order-first" type="submit">
				Send
			</button>
		</div>

		<ParametersTable {endpoint} {form} />
	</form>
</section>

{#if form}
	<CodeBlock
		code={JSON.stringify(form.result, null, 2)}
		lang="json"
		pre={form.fetchUrl}
		className="text-xs whitespace-pre-wrap"
	/>
{/if}
