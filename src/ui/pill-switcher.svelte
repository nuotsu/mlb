<script lang="ts" generics="T extends string">
	import { cn } from '#lib/utils.js'
	import type { HTMLAttributes } from 'svelte/elements'

	let {
		id,
		options,
		value,
		onchange,
		controls,
		class: className,
		...props
	}: {
		/** Prefixes each tab's id (`{id}-tab-{option}`), so a panel can be labelled by the selected one */
		id: string
		options: readonly { id: T; label: string }[]
		value: T
		onchange: (value: T) => void
		/** Ids of the panels the tabs switch, space-separated */
		controls?: string
	} & Omit<HTMLAttributes<HTMLDivElement>, 'id' | 'onchange'> = $props()

	const tabs: HTMLButtonElement[] = $state([])

	function select(next: T) {
		if (next !== value) onchange(next)
	}

	function onkeydown(e: KeyboardEvent) {
		const i = options.findIndex((o) => o.id === value)
		const next = {
			ArrowRight: (i + 1) % options.length,
			ArrowLeft: (i - 1 + options.length) % options.length,
			Home: 0,
			End: options.length - 1,
		}[e.key]
		if (next == null) return

		e.preventDefault()
		select(options[next].id)
		tabs[next]?.focus()
	}
</script>

<div
	role="tablist"
	class={cn(
		'relative isolate mx-auto flex w-max max-w-full gap-px rounded-full border border-current/25 p-px',
		className,
	)}
	{...props}
>
	<!-- One highlight, anchored to the selected tab, so it slides between them -->
	<span
		class="tab-highlight pointer-events-none absolute -z-1 rounded-full bg-accent"
		style:position-anchor="--{id}-tab-{value}"
		aria-hidden="true"
	></span>

	{#each options as option, i (option.id)}
		{@const selected = value === option.id}
		<button
			bind:this={tabs[i]}
			type="button"
			role="tab"
			id="{id}-tab-{option.id}"
			aria-selected={selected}
			aria-controls={controls}
			tabindex={selected ? 0 : -1}
			style:anchor-name="--{id}-tab-{option.id}"
			class={cn(
				'rounded-full px-[1.25ch] py-[.25ch] whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent',
				selected ? 'text-dark' : 'text-current/60 hover:bg-accent/25 hover:text-current',
			)}
			onclick={() => select(option.id)}
			{onkeydown}
		>
			{option.label}
		</button>
	{/each}
</div>

<style>
	.tab-highlight {
		top: anchor(top);
		right: anchor(right);
		bottom: anchor(bottom);
		left: anchor(left);
		transition: inset 250ms var(--ease-out);

		@media (prefers-reduced-motion: reduce) {
			transition: none;
		}
	}

	/* Without anchor positioning, the selected tab carries the highlight itself */
	@supports not (anchor-name: --a) {
		.tab-highlight {
			display: none;
		}

		[role='tab'][aria-selected='true'] {
			background-color: var(--color-accent);
		}
	}
</style>
