<script lang="ts">
	import { getToday } from '$lib/temporal'

	let { date = getToday().getDate(), ...props } = $props()
</script>

<!-- prettier-ignore -->
<svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 16 16" height="16" width="16" xmlns="http://www.w3.org/2000/svg" {...props}><path fill-rule="evenodd" clip-rule="evenodd" d="M14.5 2H13V1h-1v1H4V1H3v1H1.5l-.5.5v12l.5.5h13l.5-.5v-12l-.5-.5zM14 14H2V5h12v9zm0-10H2V3h12v1z"></path><text x="8" y="12.5" font-size="8" font-weight="bold" text-anchor="middle" fill="currentColor">{date}</text></svg>
