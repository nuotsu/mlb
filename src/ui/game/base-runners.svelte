<script lang="ts">
	import { cn } from '$lib/utils'
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
			: [first, second, third].map((r) => r?.fullName),
	)

	const isTopOrBottom = $derived(['Top', 'Bottom'].includes(linescore?.inningState ?? ''))
</script>

<div class="grid rotate-45 grid-cols-2 gap-[.5ch] {className}" {...props}>
	{#each Array.from({ length: 3 }) as _, base}
		{@const runner = runners[base]}

		<div
			class={cn('aspect-square size-[1.25lh] border border-stroke transition-colors', {
				'order-2': base === 0,
				'order-1': base === 1,
				'order-3': base === 2,
				'border-foreground/50': isTopOrBottom,
				'border-foreground bg-foreground': runner,
			})}
			title={runner
				? `${typeof runner === 'string' ? `${runner} on ` : ''}${base === 0 ? '1st' : base === 1 ? '2nd' : '3rd'} base`
				: undefined}
		></div>
	{/each}
</div>
