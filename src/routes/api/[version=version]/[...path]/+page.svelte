<script lang="ts">
	import { enhance } from '$app/forms'
	import Header from '$ui/header.svelte'
	import { InfoIcon, LoadingIcon, SendIcon } from '$ui/icons'
	import Metadata from '$ui/metadata.svelte'
	import { CUSTOM_ENDPOINT_KEY, ENDPOINTS } from '$ui/playground/constants'
	import EndpointSelect from '$ui/playground/endpoint-select.svelte'
	import ParametersTable from '$ui/playground/parameters-table.svelte'
	import Response from '$ui/playground/response.svelte'
	import posthog from 'posthog-js'
	import type { PageProps } from './$types'

	let { data, form }: PageProps = $props()

	let endpoint = $derived(form?.endpointPath ?? data.endpointKey)
	let distinctId = $state('anonymous')

	$effect(() => {
		distinctId = posthog.get_distinct_id() || 'anonymous'
	})
</script>

<Metadata
	title="Stats API Playground | MLB.TheOhtani.com"
	description="A playground for the official MLB Stats API."
/>

<Header title="Stats API Playground" crumbs={[{ name: 'Stats API Playground' }]} />

<section class="flex flex-col pt-lh sm:max-h-[calc(100dvh-var(--header-height))]">
	<article class="top-0 z-1 bg-background">
		<form class="grid gap-ch px-ch" method="POST" use:enhance>
			<input name="distinctId" value={distinctId} type="hidden" />

			<div class="flex flex-wrap items-stretch gap-ch max-sm:flex-col">
				<EndpointSelect bind:value={endpoint} />

				<button class="action max-sm:grow max-sm:active:scale-95 sm:order-first" type="submit">
					Send
					<SendIcon class="send-icon" />
					<LoadingIcon class="loading-icon animate-spin" />
				</button>
			</div>

			{#if ENDPOINTS[endpoint].description}
				<div class="flex gap-ch bg-accent/10 p-ch text-sm">
					<InfoIcon class="size-lh shrink-0 text-accent" aria-label="Endpoint description" />
					<p>{ENDPOINTS[endpoint].description}</p>
				</div>
			{/if}

			<ParametersTable {endpoint} initialParams={data.initialParams} />
		</form>
	</article>

	<Response />
</section>

<style>
	:global(body:has(.loading-results) svg.send-icon) {
		display: none;
	}

	:global(body:not(:has(.loading-results)) svg.loading-icon) {
		display: none;
	}
</style>
