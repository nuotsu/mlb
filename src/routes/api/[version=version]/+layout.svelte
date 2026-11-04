<script lang="ts">
	import { analyticsEnabled } from '#lib/analytics.js'
	import ClickToCopy from '#ui/click-to-copy.svelte'
	import Header from '#ui/header.svelte'
	import { InfoIcon, SendIcon } from '#ui/icons/index.js'
	import Metadata from '#ui/metadata.svelte'
	import { ENDPOINTS, HOST } from '#ui/playground/constants.js'
	import { prefetchJsonViewer } from '#ui/playground/json/load.js'
	import ParametersTable from '#ui/playground/parameters-table.svelte'
	import { ParamState } from '#ui/playground/params.svelte.js'
	import { resolveRequest } from '#ui/playground/request.js'
	import Response from '#ui/playground/response.svelte'
	import { Runner } from '#ui/playground/runner.svelte.js'
	import SelectEndpoint from '#ui/playground/select-endpoint.svelte'
	import { endpointToUrl } from '#ui/playground/utils.js'
	import { afterNavigate, goto, replaceState } from '$app/navigation'
	import { page } from '$app/state'
	import posthog from 'posthog-js'

	let { children } = $props()

	/** Shown in the picker right away; the page catches up once navigation to it finishes */
	let endpoint = $derived(page.data.endpointKey as string)
	let params = $derived(new ParamState(page.data.endpointKey, page.data.initialParams))
	let request = $derived(resolveRequest(page.data.endpointKey, params.values))

	const runner = new Runner(page.data.autoRun)

	/** Server HTML for a deep link shows the skeleton, but nothing is "sending" until JS runs */
	let hydrated = $state(false)
	const busy = $derived(hydrated && runner.loading)

	afterNavigate(({ type, shallow }) => {
		hydrated = true
		// Send's own replaceState is shallow; the request is already running
		if (shallow) return

		// Picking an endpoint (goto) starts a fresh form; opening or following a deep link runs it
		if (type !== 'goto' && page.data.autoRun && request.valid) send({ updateUrl: false })
		else runner.reset()
	})

	function distinctId() {
		return analyticsEnabled ? posthog.get_distinct_id() || 'anonymous' : undefined
	}

	function send({ updateUrl = true } = {}) {
		const current = request
		if (!current.valid) {
			document.getElementById(current.missing[0] ?? 'custom')?.focus()
			return
		}

		runner.run(current, distinctId())

		// Shallow: the address bar becomes a shareable deep link without re-running load
		if (updateUrl && current.pageUrl !== page.url.pathname + page.url.search) {
			replaceState(current.pageUrl, page.state)
		}
	}

	function onsubmit(event: SubmitEvent) {
		event.preventDefault()
		send()
	}

	function selectEndpoint(key: string) {
		endpoint = key
		runner.reset()
		goto(endpointToUrl(key))
	}
</script>

<svelte:head>
	<noscript>
		<style>
			.playground-response {
				display: none !important;
			}
		</style>
	</noscript>
</svelte:head>

<Metadata
	title="Stats API Playground | MLB.TheOhtani.com"
	description="A playground for the official MLB Stats API."
/>

<Header title="Stats API Playground" crumbs={[{ name: 'Stats API Playground' }]} />

<!-- Desktop: fit the viewport so the response scrolls on its own; `main` loses 1ch to the open sidebar's frame -->
<section
	class="playground flex flex-col gap-y-ch pt-lh sm:max-h-[calc(100dvh-var(--header-height))] sm:sidebar-open:max-h-[calc(100dvh-1ch-var(--header-height))]"
>
	<article class="bg-background">
		<form id="playground-form" class="grid gap-ch px-ch" method="POST" {onsubmit}>
			<input name="rendered-endpoint" value={page.data.endpointKey} type="hidden" />

			<div class="flex flex-wrap items-stretch gap-ch max-sm:flex-col">
				<SelectEndpoint value={endpoint} onselect={selectEndpoint} />

				<button
					class="action max-sm:hidden sm:order-first"
					type="submit"
					aria-busy={busy}
					onpointerenter={prefetchJsonViewer}
					onfocus={prefetchJsonViewer}
				>
					Send
					<SendIcon class={busy ? 'animate-pulse motion-reduce:animate-none' : ''} />
				</button>
			</div>

			{#if ENDPOINTS[endpoint]?.description}
				<div class="flex gap-ch bg-accent/10 p-ch text-sm">
					<InfoIcon class="size-lh shrink-0 text-accent" aria-label="Endpoint description" />
					<p>{ENDPOINTS[endpoint].description}</p>
				</div>
			{/if}

			<div class="flex items-start gap-ch text-xs">
				<code class="min-w-0 grow break-all" aria-label="Request URL">
					<span class="text-current/50">GET {HOST}</span><span
						class={request.valid ? '' : 'text-[red]'}>{request.endpoint}</span
					>
				</code>
				<ClickToCopy
					value={request.mlbUrl}
					class="shrink-0 p-[.25ch] text-current/60 hover:text-current max-sm:p-ch [&_svg]:size-[1.2em]"
				>
					<span class="sr-only">Copy request URL</span>
				</ClickToCopy>
			</div>

			{#if request.missing.length}
				<p class="text-xs text-[red]">Fill in {request.missing.join(', ')} to send.</p>
			{/if}

			<ParametersTable endpoint={page.data.endpointKey} values={params.values} />

			<noscript>
				<p class="text-xs text-current/60">
					JavaScript is off: Send opens the raw JSON response from the Stats API.
				</p>
			</noscript>
		</form>
	</article>

	{#if runner.status !== 'idle'}
		<Response {runner} onretry={() => send({ updateUrl: false })} />
	{/if}

	<div
		class="sticky bottom-0 z-10 flex gap-ch border-t border-current/10 bg-background/90 p-ch pb-[max(1ch,env(safe-area-inset-bottom))] backdrop-blur-xs sm:hidden"
	>
		<button
			form="playground-form"
			class="action h-11 grow text-base"
			type="submit"
			aria-busy={busy}
			onpointerenter={prefetchJsonViewer}
			onfocus={prefetchJsonViewer}
			ontouchstart={prefetchJsonViewer}
		>
			Send
			<SendIcon class={busy ? 'animate-pulse motion-reduce:animate-none' : ''} />
		</button>

		{#if busy}
			<button type="button" class="action-tertiary h-11" onclick={() => runner.abort()}>
				Cancel
			</button>
		{/if}
	</div>
</section>

{@render children()}

<style>
	/* Accent focus ring for every control in the playground (form, response header, viewer) */
	/* :where keeps this below the viewer's own inset ring; .outline-none opts a control out */
	.playground :global(:where(:focus-visible:not(.outline-none))) {
		outline: 2px solid var(--color-accent);
		outline-offset: 1px;
	}
</style>
