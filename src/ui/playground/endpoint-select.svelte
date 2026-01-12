<script lang="ts">
	import { CUSTOM_ENDPOINT_KEY, DIRECTORY, ENDPOINTS, HOST } from './constants'

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

<label class="flex items-center px-ch">
	<span class="line-clamp-1 shrink break-all text-current/50">{HOST}</span>

	<select
		name="endpoint-path"
		class="field-sizing-content h-lh min-w-[6ch] shrink-0 input"
		bind:value
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
