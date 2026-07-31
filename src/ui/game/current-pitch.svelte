<script lang="ts">
	import { pitchSpeedColor } from '$lib/colors'
	import { cn } from '$lib/utils'

	let { liveGame }: { liveGame?: MLB.LiveGameFeed } = $props()

	const pitch = $derived(
		liveGame?.liveData.plays.currentPlay?.playEvents?.filter((event) => event.isPitch).at(-1),
	)
</script>

{#key pitch?.index}
	<div class="min-h-rlh border-dashed border-stroke text-[x-small]" class:border-t={!!pitch}>
		{#if pitch?.details}
			{@const { type, isBall, isStrike, isInPlay, description, call } = pitch.details}
			{@const speed = pitch.pitchData?.startSpeed}
			<p class="flex h-rlh anim-fade-to-r items-center justify-center gap-x-ch">
				<span
					class={cn(
						'inline-grid size-lh shrink-0 place-items-center rounded-full bg-foreground text-[10px] text-background',
						{
							'bg-accent text-dark': isBall,
							'bg-yellow-300 text-dark': isStrike,
							'bg-blue-500 text-light': isInPlay,
						},
					)}
				>
					{(pitch.index ?? 0) + 1}
				</span>

				{#if type?.description}
					<span class="line-clamp-1 break-all">
						{#if type.description === 'Four-Seam Fastball'}
							4-Seam Fastball
						{:else if type.description === 'Two-Seam Fastball'}
							2-Seam Fastball
						{:else}
							{type.description}
						{/if}
					</span>
				{/if}

				{#if speed}
					<span class="relative leading-none" style:color={pitchSpeedColor(speed)}>
						{speed}
						<small class="absolute top-full left-1/2 -translate-x-1/2 text-[7px]">mph</small>
					</span>
				{/if}

				{#if description}
					<span
						class={cn('shrink-0', {
							positive: isBall,
							'text-yellow-500 dark:text-yellow-200': isStrike,
							'text-red-500 dark:text-red-300': isInPlay,
							'text-blue-500 dark:text-blue-300':
								isInPlay && (description.includes('no out') || description.includes('run')),
						})}
					>
						{call?.description}
					</span>
				{/if}
			</p>
		{/if}
	</div>
{/key}
