<script lang="ts">
	import { cn } from '$lib/utils'
	import Headshot from '$ui/player/headshot.svelte'
	import type { HTMLAttributes } from 'svelte/elements'

	let {
		runnerIndex = [],
		linescore,
		class: className,
		...props
	}: {
		runnerIndex?: number[]
		linescore?: MLB.Linescore
	} & HTMLAttributes<HTMLDivElement> = $props()

	const { first, second, third } = $derived(linescore?.offense ?? {})

	const runners = $derived(
		runnerIndex.length
			? Array.from({ length: 3 }, (_, i) => runnerIndex.includes(i + 1) || undefined)
			: [first, second, third],
	)

	const isTopOrBottom = $derived(['Top', 'Bottom'].includes(linescore?.inningState ?? ''))
</script>

<div class="grid rotate-45 grid-cols-2 gap-[.5ch] {className}" {...props}>
	{#each Array.from({ length: 3 }) as _, base (base)}
		{@const runner = runners[base]}

		<div
			class={cn('relative aspect-square size-lh border border-stroke transition-colors', {
				'order-2': base === 0,
				'order-1': base === 1,
				'order-3': base === 2,
				'border-foreground/50': isTopOrBottom,
				'border-foreground bg-foreground': runner,
			})}
			title={runner
				? `${typeof runner === 'object' ? `${runner.fullName} on ` : ''}${base === 0 ? '1st' : base === 1 ? '2nd' : '3rd'} base`
				: undefined}
		>
			<!-- only the live diamond receives a linescore, so only it can show avatars -->
			{#if typeof runner === 'object'}
				<!--
					keyed so a different player taking over the base remounts the node and
					replays the entry animation — otherwise @starting-style never re-fires
					and the image would swap in silently.
				-->
				{#key runner.id}
					<!--
						counter-rotates the parent grid so the avatar sits upright.
						sized against the base's own side; the visible diamond is 1.414x that
						(rotate-45), so at 175% the head clears the top corner and the chisel
						point overshoots the bottom corner.

						@starting-style supplies the pre-mount state, so the fade+scale fires
						when the feed reports a runner arriving. it drives opacity/scale only:
						the repo's anim-fade utility animates `translate` with fill-mode
						forwards, which would permanently clobber the -translate-1/2 centering.
					-->
					<div
						class="pointer-events-none absolute top-1/2 left-1/2 size-[175%] -translate-1/2 scale-100 -rotate-45 opacity-100 transition-[opacity,scale] starting:scale-90 starting:opacity-0"
					>
						<!--
							nudge lives here, inside the counter-rotation, so it reads as straight
							up on screen — on the wrapper above it would travel diagonally with the
							grid's 45deg. 10% of the box ≈ the overshoot, seating the chisel point
							on the base's bottom corner. relative so it scales with the diamond.
						-->
						<Headshot
							person={runner}
							type="silo"
							size={120}
							class="size-full max-w-none -translate-y-[10%] [clip-path:polygon(0_0,100%_0,100%_50%,50%_100%,0_50%)]"
						/>
					</div>
				{/key}
			{/if}
		</div>
	{/each}
</div>
