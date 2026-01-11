<script lang="ts">
	import { DIRECTORY, HOST } from './constants'

	let { value = $bindable() } = $props()

	const { host, pathname } = new URL(HOST)

	function parametersToString(parameters?: Docs.EndpointParameter) {
		return Object.keys(parameters ?? {})
			?.map((key) => `${key}={${key}}`)
			.filter(Boolean)
			.join('&')
	}
</script>

<label class="flex items-center px-ch">
	<span class="line-clamp-1 shrink break-all text-current/50">{host}</span>
	<span class="shrink-0">{pathname}</span>

	<select class="field-sizing-content h-lh min-w-[4ch] shrink-0" name="endpoint" bind:value>
		{#each Object.entries(DIRECTORY) as [label, endpoints]}
			<optgroup {label}>
				{#each Object.keys(endpoints) as e}
					<option
						value={[e, parametersToString(endpoints[e]?.parameters)].filter(Boolean).join('?')}
					>
						{e}
					</option>
				{/each}
			</optgroup>
		{/each}
	</select>
</label>
