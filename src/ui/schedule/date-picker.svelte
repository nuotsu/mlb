<script lang="ts">
	import { goto } from '$app/navigation'
	import { page } from '$app/state'
	import { formatDate, getToday, slash } from '$lib/temporal'

	let date = $derived(page.params.date)

	function addDay(days: number = 1) {
		return formatDate(
			new Date(new Date(slash(date)).setDate(new Date(slash(date)).getDate() + days)),
			{ locale: 'en-CA' },
		)
	}

	$effect(() => {
		goto(`/schedule/day/${date}`)
	})
</script>

<fieldset class="flex flex-col items-center text-center">
	<a href="/schedule/week/{date}" class="block text-sm leading-rlh">
		{formatDate(slash(date), { weekday: 'long' })}
	</a>

	<div class="flex justify-center">
		<label class="min-w-[16ch]">
			{formatDate(slash(date), {
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

		<a class="order-first" href="/schedule/day/{addDay(-1)}">{'<'}</a>
		<a class="order-last" href="/schedule/day/{addDay()}">{'>'}</a>
	</div>
</fieldset>

<style>
	label,
	a {
		padding-inline: 1ch;

		&:hover {
			text-decoration: underline dashed;
		}
	}
</style>
