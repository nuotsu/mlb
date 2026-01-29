<script lang="ts">
	import { getToday } from '$lib/temporal'
	import { cn } from '$lib/utils'

	let { date = '', until }: { date?: string; until: string } = $props()

	function getTimeDiff() {
		return new Date(date).getTime() - getToday().getTime()
	}

	let timeDiff = $derived(getTimeDiff())
	let interval: NodeJS.Timeout | null = $state(null)

	$effect(() => {
		interval = setInterval(() => {
			timeDiff = getTimeDiff()
		}, 1000)

		return () => clearInterval(interval!)
	})

	const duration = $derived(
		(() => {
			const seconds = Math.floor(timeDiff / 1000)
			const minutes = Math.floor(seconds / 60)
			const hours = Math.floor(minutes / 60)
			const days = Math.floor(hours / 24)

			return [days, hours % 24, minutes % 60, seconds % 60]
		})(),
	)
</script>

{#if timeDiff > 0}
	<article>
		<div class="flex items-baseline justify-center text-3xl">
			{#each ['days', 'hr', 'min', 'sec'] as part, i}
				{@const value = duration[i]}
				{@const isDay = part === 'days'}

				{#if !isDay || value}
					<div class={cn('grid', isDay && 'mr-ch')}>
						<b class="font-mono tabular-nums">
							{isDay ? value : value.toString().padStart(2, '0')}
						</b>

						<small class="text-sm uppercase">
							{#if isDay}
								{value === 1 ? 'day' : 'days'}
							{:else}
								{part}
							{/if}
						</small>
					</div>
				{/if}

				{#if part !== 'days' && i < duration.length - 1}
					<span class="font-mono tabular-nums">:</span>
				{/if}
			{/each}
		</div>

		{#if until}
			<p>
				until <a class="decoration-dashed hover:underline" href="/schedule/day/{date}">{until}</a>
			</p>
		{/if}
	</article>
{/if}
