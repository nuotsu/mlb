<script lang="ts">
	import { replaceState } from '$app/navigation'
	import { page } from '$app/state'
	import { CUSTOM_ENDPOINT_KEY, DIRECTORY, ENDPOINTS, HOST } from './constants'

	let { protocol, host } = new URL(HOST)

	let { value = $bindable() } = $props()

	let endpoint = $derived(
		[value, paramsToString(ENDPOINTS[value]?.queryParams)].filter(Boolean).join('?'),
	)

	function paramsToString(params?: Docs.EndpointSchema) {
		return Object.keys(params ?? {})
			?.map((key) => !value.includes(`{${key}}`) && `${key}={${key}}`)
			.filter(Boolean)
			.join('&')
	}
</script>

<label class="flex items-center">
	<span class="flex break-all text-current/50">
		<span class="shrink-0 max-sm:hidden">{protocol}//</span>
		<span class="line-clamp-1 shrink">{host}</span>
	</span>

	<select
		name="endpoint-path"
		class="input field-sizing-content h-lh min-w-[6ch] shrink-0"
		bind:value
		onchange={() => {
			if (page.url.searchParams.has('endpoint')) {
				replaceState('', window.location.pathname)
			}
		}}
	>
		<option value={CUSTOM_ENDPOINT_KEY}>{CUSTOM_ENDPOINT_KEY}</option>

		{#each Object.entries(DIRECTORY) as [label, endpoints]}
			<optgroup {label}>
				{#each Object.keys(endpoints) as e}
					<option value={e}>{e}</option>
				{/each}
			</optgroup>
		{/each}
	</select>
</label>

<input name="endpoint" type="hidden" bind:value={endpoint} readonly />
