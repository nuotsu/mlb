<script lang="ts">
	import { CollapseVerticalIcon, ExpandVerticalIcon } from '$ui/icons'
</script>

<button
	class="not-hover:text-current/50"
	onclick={() => {
		const allDetails = document.querySelectorAll('details')
		const hasOpen = Array.from(allDetails).some((detail) => detail.open)

		allDetails.forEach((detail) => {
			detail.open = hasOpen ? false : true
		})
	}}
	title="Toggle all details"
>
	<CollapseVerticalIcon data-collapse />
	<ExpandVerticalIcon data-expand />
</button>

<style>
	:global(main:has(section details[open]) [data-expand]),
	:global(main:not(:has(section details[open])) [data-collapse]) {
		display: none;
	}
</style>
