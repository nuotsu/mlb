<script lang="ts">
	import { formatDate, getToday } from '$lib/temporal'
	import { weekStore } from './store.svelte'

	const { startDate, endDate } = $derived(weekStore)

	const isSameMonth = $derived(startDate.getMonth() === endDate.getMonth())
</script>

<fieldset class="flex flex-col items-center">
	<label for="week" class="block text-sm leading-rlh">Weekly Schedule</label>

	<div class="flex justify-center">
		<label class="min-w-[16ch] text-center">
			{formatDate(startDate, { month: isSameMonth ? 'long' : 'short', day: 'numeric' })}
			-
			{formatDate(endDate, isSameMonth ? { day: 'numeric' } : { month: 'short', day: 'numeric' })}

			<input
				id="week"
				class="sr-only"
				type="date"
				min="1901-01-01"
				max={`${getToday().getFullYear()}-12-31`}
				onclick={(e) => (e.target as HTMLInputElement)?.showPicker()}
				bind:value={weekStore.today}
			/>
		</label>

		<button class="order-first" onclick={() => weekStore.addWeek(-1)}>{'<'}</button>
		<button class="order-last" onclick={() => weekStore.addWeek()}>{'>'}</button>
	</div>
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
