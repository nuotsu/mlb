<script lang="ts">
	import { formatDate, getToday } from '$lib/temporal'
	import Metadata from '$ui/metadata.svelte'

	let today = $state(getToday())
	let day = $derived((today.getDay() - 1) % 7)

	let startDate = $derived(new Date(today.setDate(today.getDate() - day)))
	let endDate = $derived(new Date(today.setDate(startDate.getDate() + 6)))
</script>

<Metadata title="Schedule | MLB.TheOhtani.com" description="Weekly calendar of MLB games." />

<section class="p-ch">
	<nav>
		{formatDate(startDate, { month: 'short', day: 'numeric' })}
		-
		{#if startDate.getMonth() === endDate.getMonth()}
			{formatDate(endDate, { day: 'numeric' })}
		{:else}
			{formatDate(endDate, { month: 'short', day: 'numeric' })}
		{/if}
	</nav>
</section>
