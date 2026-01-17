<script lang="ts">
	import { formatDate } from '$lib/temporal'
	import { scheduleStore } from './store.svelte'

	const { startDate, endDate } = $derived(scheduleStore)

	let input = $state<HTMLInputElement | null>(null)
</script>

<fieldset class="flex gap-ch">
	<button onclick={() => scheduleStore.addWeek(-1)}>{'<'}</button>

	<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
	<label onclick={() => input?.showPicker()}>
		{formatDate(startDate, { month: 'short', day: 'numeric' })}
		-
		{#if startDate.getMonth() === endDate.getMonth()}
			{formatDate(endDate, { day: 'numeric' })}
		{:else}
			{formatDate(endDate, { month: 'short', day: 'numeric' })}
		{/if}

		<input class="sr-only" type="date" bind:value={scheduleStore.today} bind:this={input} />
	</label>

	<button onclick={() => scheduleStore.addWeek()}>{'>'}</button>
</fieldset>
