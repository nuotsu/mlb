<script lang="ts">
	import ClickToCopy from '#ui/click-to-copy.svelte'
	import JsonSkeleton from './json/json-skeleton.svelte'
	import { loadJsonViewer } from './json/load'
	import type { Runner } from './runner.svelte'

	let { runner, onretry }: { runner: Runner; onretry: () => void } = $props()

	const request = $derived(runner.request)
	const result = $derived(runner.result)
	const error = $derived(runner.error)

	const fileName = $derived(
		(request?.path ?? 'response')
			.replace(/^\/api\//, '')
			.replace(/[^\w.-]+/g, '-')
			.replace(/^-|-$/g, '') + '.json',
	)

	const ERROR_TITLE = {
		http: 'Request failed',
		timeout: 'Timed out',
		network: 'Network error',
		cancelled: 'Cancelled',
	} as const

	function formatKB(bytes: number) {
		return `${(bytes / 1024).toLocaleString(undefined, { maximumFractionDigits: 1 })} KB`
	}
</script>

<article
	class="playground-response flex flex-col bg-[#0a0c10] text-[#f0f3f6] sm:min-h-0 sm:flex-1"
	aria-busy={runner.loading}
>
	<header
		class="flex flex-wrap items-center gap-x-ch gap-y-[.5ch] border-b border-white/15 px-ch py-[.5ch] text-xs"
	>
		<p class="flex flex-wrap items-center gap-x-ch tabular-nums" role="status">
			{#if runner.loading}
				<span class="inline-flex items-center gap-[.5ch]">
					<span class="spinner" aria-hidden="true"></span>
					Loading…
				</span>
			{:else if result}
				<span
					class="px-[.5ch] font-bold text-black {result.ok ? 'bg-[#72f088]' : 'bg-[#ff9492]'}"
					data-status={result.status}
				>
					{result.status}
					{result.statusText}
				</span>
				<span data-ms={Math.round(result.ms)}>{Math.round(result.ms).toLocaleString()} ms</span>
				<span>{formatKB(result.bytes)}</span>
			{:else if error}
				<span class="font-bold text-[#ff9492]">{ERROR_TITLE[error.kind]}</span>
			{/if}
		</p>

		{#if request}
			<code class="min-w-0 grow basis-[20ch] truncate text-white/60" title={request.mlbUrl}>
				{request.endpoint}
			</code>
		{/if}

		<menu class="ml-auto flex flex-wrap gap-[.5ch] [&_button]:min-h-8 max-sm:[&_button]:min-h-10">
			{#if runner.loading}
				<li>
					<button type="button" class="action-tertiary" onclick={() => runner.abort()}>
						Cancel
					</button>
				</li>
			{/if}
			{#if request}
				<li>
					<ClickToCopy value={request.mlbUrl} class="action-tertiary">Full URL</ClickToCopy>
				</li>
				<li>
					<ClickToCopy value={request.endpoint} class="action-tertiary">Endpoint</ClickToCopy>
				</li>
			{/if}
		</menu>
	</header>

	{#if error}
		<div class="m-ch border border-[#ff9492]/50 bg-[#ff9492]/10 p-ch text-sm" role="alert">
			<p>
				<strong>
					{ERROR_TITLE[error.kind]}{error.status ? ` (HTTP ${error.status})` : ''}
				</strong>: {error.message}
			</p>
			{#if error.kind !== 'http' || (error.status ?? 0) >= 500}
				<button type="button" class="mt-ch action-tertiary" onclick={onretry}>Try again</button>
			{/if}
		</div>
	{/if}

	{#if runner.loading}
		<div class="flex min-h-0 flex-1 flex-col max-sm:h-[60svh]">
			<JsonSkeleton />
		</div>
	{:else if result?.text}
		{#key result}
			{#await loadJsonViewer()}
				<div class="flex min-h-0 flex-1 flex-col max-sm:h-[60svh]">
					<JsonSkeleton />
				</div>
			{:then { default: JsonViewer }}
				<JsonViewer text={result.text} {fileName} />
			{:catch}
				<p class="p-ch text-sm">
					Couldn't load the JSON viewer.
					<button type="button" class="link" onclick={onretry}>Retry</button>
				</p>
			{/await}
		{/key}
	{/if}
</article>

<style>
	.spinner {
		width: 1em;
		height: 1em;
		border: 2px solid currentColor;
		border-right-color: transparent;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to {
			rotate: 1turn;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.spinner {
			animation-duration: 3s;
		}
	}
</style>
