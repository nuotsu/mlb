<script lang="ts">
	import { DIRECTORY, ENDPOINTS, HOST } from './constants'

	let { value = $bindable() } = $props()

	const { host, pathname } = new URL(HOST)

	let endpointWithParameters = $derived(
		[value, parametersToString(ENDPOINTS[value]?.parameters)].filter(Boolean).join('?'),
	)

	function parametersToString(parameters?: Docs.EndpointFragment) {
		return Object.keys(parameters ?? {})
			?.map((key) => !value.includes(`{${key}}`) && `${key}={${key}}`)
			.filter(Boolean)
			.join('&')
	}
</script>

<label class="flex items-center px-ch">
	<span class="line-clamp-1 shrink break-all text-current/50">{host}</span>

	<span class="shrink-0">{pathname}</span>

	<select class="field-sizing-content h-lh min-w-[6ch] shrink-0 input" name="endpoint" bind:value>
		{#each Object.entries(DIRECTORY) as [label, endpoints]}
			<optgroup {label}>
				{#each Object.keys(endpoints) as e}
					<option value={e}>{e}</option>
				{/each}
			</optgroup>
		{/each}
	</select>
</label>

<input name="endpoint-with-parameters" type="hidden" bind:value={endpointWithParameters} readonly />
