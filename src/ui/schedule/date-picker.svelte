<script lang="ts">
	import { formatDate } from '$lib/temporal'
	import { scheduleStore } from './store.svelte'

	const { startDate, endDate } = $derived(scheduleStore)
</script>

<fieldset class="flex justify-center">
	<label class="min-w-[13ch] text-center">
		{formatDate(startDate, { month: 'short', day: 'numeric' })}
		-
		{#if startDate.getMonth() === endDate.getMonth()}
			{formatDate(endDate, { day: 'numeric' })}
		{:else}
			{formatDate(endDate, { month: 'short', day: 'numeric' })}
		{/if}

		<input
			class="sr-only"
			type="date"
			onclick={(e) => (e.target as HTMLInputElement)?.showPicker()}
			bind:value={scheduleStore.today}
		/>
	</label>

	<button class="order-first" onclick={() => scheduleStore.addWeek(-1)}>{'<'}</button>
	<button class="order-last" onclick={() => scheduleStore.addWeek()}>{'>'}</button>
</fieldset>

<style>
	label,
	button {
		padding-inline: 1ch;

		&:hover {
			text-decoration: underline dashed;
		}
	}
</style>
