<script lang="ts">
	import { goto } from '$app/navigation'
	import { page } from '$app/state'
	import { formatDate, getToday } from '$lib/temporal'

	let date = $derived(page.params.date)

	function addDay(days: number = 1) {
		date = formatDate(
			new Date(new Date(date + 'T00:00:00').setDate(new Date(date + 'T00:00:00').getDate() + days)),
			{
				locale: 'en-CA',
				year: 'numeric',
				month: '2-digit',
				day: '2-digit',
			},
		)
	}

	$effect(() => {
		goto(`/schedule/${date}`)
	})
</script>

<fieldset class="flex flex-col items-center text-center">
	<label for="date" class="block text-sm leading-rlh">
		{formatDate(date + 'T00:00:00', { weekday: 'long' })}
	</label>

	<div class="flex justify-center">
		<label class="min-w-[16ch]">
			{formatDate(date + 'T00:00:00', {
				month: 'long',
				day: 'numeric',
				year: 'numeric',
			})}

			<input
				id="date"
				class="sr-only"
				type="date"
				min="1901-01-01"
				max={`${getToday().getFullYear()}-12-31`}
				onclick={(e) => (e.target as HTMLInputElement)?.showPicker()}
				bind:value={date}
			/>
		</label>

		<button class="order-first" onclick={() => addDay(-1)}>{'<'}</button>
		<button class="order-last" onclick={() => addDay()}>{'>'}</button>
	</div>
</fieldset>

<style>
	fieldset:has(label:hover) label,
	button {
		padding-inline: 1ch;
	}

	fieldset:has(label:hover) label,
	button:hover {
		text-decoration: underline dashed;
	}
</style>
