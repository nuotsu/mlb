<script lang="ts">
	import { mutationObserver } from '$lib/attachments'
	import CodeBlock from '$ui/code-block/code-block.svelte'
	import { addButtonHandlers } from '$ui/code-block/utils'
	import EndpointSelect from '$ui/playground/endpoint-select.svelte'
	import ParametersTable from '$ui/playground/parameters-table.svelte'
	import type { PageProps } from './$types'

	let { form }: PageProps = $props()

	let endpoint = $derived(form?.endpoint ?? '/{custom}')
</script>

<section {@attach mutationObserver(addButtonHandlers)}>
	<header class="top-0 z-1 bg-background sm:sticky">
		<form class="space-ch mx-auto grid max-w-5xl gap-ch p-ch" method="POST">
			<div class="flex flex-wrap items-stretch gap-y-ch max-sm:flex-col">
				<EndpointSelect bind:value={endpoint} />

				<button class="action max-sm:grow max-sm:active:scale-95 sm:order-first" type="submit">
					Send

					<!-- prettier-ignore -->
					<svg class="send-icon" stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 16 16" height="200px" width="200px" xmlns="http://www.w3.org/2000/svg"><path d="M3.78 2L3 2.41v12l.78.42 9-6V8l-9-6zM4 13.48V3.35l7.6 5.07L4 13.48z"></path></svg>

					<!-- prettier-ignore -->
					<svg class="loading-icon animate-spin" stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 16 16" height="200px" width="200px" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M13.917 7A6.002 6.002 0 0 0 2.083 7H1.071a7.002 7.002 0 0 1 13.858 0h-1.012z"></path></svg>
				</button>
			</div>

			<ParametersTable {endpoint} />
		</form>
	</header>

	{#if form}
		<CodeBlock
			code={JSON.stringify(form.result, null, 2)}
			lang="json"
			pre={form.fetchUrl}
			className="text-xs whitespace-pre-wrap"
		/>
	{/if}
</section>

<style>
	svg {
		width: 1em;
		height: 1em;

		:global(body:has(.loading-results)) &.send-icon {
			display: none;
		}

		:global(body:not(:has(.loading-results))) &.loading-icon {
			display: none;
		}
	}
</style>
