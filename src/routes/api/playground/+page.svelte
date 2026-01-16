<script lang="ts">
	import { enhance } from '$app/forms'
	import Metadata from '$ui/metadata.svelte'
	import { CUSTOM_ENDPOINT_KEY } from '$ui/playground/constants'
	import EndpointSelect from '$ui/playground/endpoint-select.svelte'
	import ParametersTable from '$ui/playground/parameters-table.svelte'
	import Response from '$ui/playground/response.svelte'
	import posthog from 'posthog-js'
	import type { PageProps } from './$types'

	let { form }: PageProps = $props()

	let endpoint = $derived(form?.endpointPath ?? CUSTOM_ENDPOINT_KEY)
	let distinctId = $state('anonymous')

	$effect(() => {
		distinctId = posthog.get_distinct_id() || 'anonymous'
	})
</script>

<Metadata
	title="Stats API Playground | MLB.TheOhtani.com"
	description="A playground for the official MLB Stats API."
/>

<section class="flex flex-col sm:max-h-dvh">
	<header class="top-0 z-1 bg-background sm:sticky">
		<form class="space-ch mx-auto grid max-w-5xl gap-ch p-ch" method="POST" use:enhance>
			<input name="distinctId" value={distinctId} type="hidden" />

			<div class="flex flex-wrap items-stretch gap-ch max-sm:flex-col">
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

	<Response />
</section>

<style>
	svg {
		:global(body:has(.loading-results)) &.send-icon {
			display: none;
		}

		:global(body:not(:has(.loading-results))) &.loading-icon {
			display: none;
		}
	}
</style>
