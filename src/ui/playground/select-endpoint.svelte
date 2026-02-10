<script lang="ts">
	import { goto } from '$app/navigation'
	import { CUSTOM_ENDPOINT_KEY, DIRECTORY, ENDPOINTS, HOST } from './constants'
	import { endpointToUrl } from './utils'

	let { protocol, host } = new URL(HOST)

	let { value = $bindable() } = $props()

	let endpoint = $derived(
		[value, paramsToString(ENDPOINTS[value]?.queryParams)].filter(Boolean).join('?'),
	)

	function paramsToString(params?: Docs.EndpointParams) {
		return Object.keys(params ?? {})
			?.map((key) => !value.includes(`{${key}}`) && `${key}={${key}}`)
			.filter(Boolean)
			.join('&')
	}
</script>

<label class="flex flex-wrap items-center">
	<span class="flex break-all text-current/50">
		<span class="shrink-0 max-sm:hidden">{protocol}//</span>
		<span class="line-clamp-1 shrink">{host}</span>
	</span>

	<select
		name="endpoint-path"
		class="input-dev field-sizing-content h-lh grow max-sm:w-full"
		bind:value
		onchange={() => goto(endpointToUrl(value))}
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
