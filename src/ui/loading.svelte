<script lang="ts">
	let { class: className = '' } = $props()
</script>

<aside class="flex items-center gap-ch {className}">
	<!-- prettier-ignore -->
	<svg class="animate-spin size-[1em]" stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 16 16" height="200px" width="200px" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M13.917 7A6.002 6.002 0 0 0 2.083 7H1.071a7.002 7.002 0 0 1 13.858 0h-1.012z"></path></svg>

	Loading...
</aside>
