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

	// only the live diamond receives a linescore, so only it can show avatars
	const hasPeople = $derived(runners.some((r) => typeof r === 'object'))

	let active = $state(false)

	const showAvatars = $derived(active && hasPeople)

	const clearIfMouse = (e: PointerEvent) => {
		if (e.pointerType === 'mouse') active = false
	}
</script>

<!-- dismiss a touch-held reveal when the next tap lands elsewhere -->
<svelte:window
	onpointerdown={(e) => {
		if (active && !(e.target as Element)?.closest?.('[data-runner-active]')) active = false
	}}
/>

<div
	class="grid rotate-45 grid-cols-2 gap-[.5ch] {className}"
	data-runner-active={showAvatars || undefined}
	onpointerenter={(e) => {
		if (hasPeople && e.pointerType === 'mouse') active = true
	}}
	onpointerdown={(e) => {
		// mouse is driven by enter/leave; toggling here would hide avatars mid-hover
		if (hasPeople && e.pointerType !== 'mouse') active = !active
	}}
	onpointerleave={clearIfMouse}
	onpointercancel={clearIfMouse}
	{...props}
>
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
			{#if typeof runner === 'object'}
				<!--
					counter-rotates the parent grid so the avatar sits upright.
					sized against the base's own side; the visible diamond is 1.414x that
					(rotate-45), so at 175% the head clears the top corner and the chisel
					point overshoots the bottom corner.
				-->
				<div
					class={cn(
						'pointer-events-none absolute top-1/2 left-1/2 size-[175%] -translate-1/2 -rotate-45 transition-[opacity,scale]',
						showAvatars ? 'scale-100 opacity-100' : 'scale-90 opacity-0',
					)}
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
						size={240}
						class="size-full max-w-none -translate-y-[10%] [clip-path:polygon(0_0,100%_0,100%_50%,50%_100%,0_50%)]"
					/>
				</div>
			{/if}
		</div>
	{/each}
</div>
