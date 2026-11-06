<script lang="ts">
	import { WIDGET_SIZE_LABELS } from '#lib/home.js'
	import { ChevronRightIcon, EyeOffIcon, GripIcon } from '#ui/icons/index.js'
	import { tick, type Snippet } from 'svelte'
	import { getWidgetCell } from './context.js'
	import { homeStore } from './store.svelte.js'

	let {
		title,
		href,
		linkLabel = 'View all',
		class: className,
		bodyClass = 'p-ch',
		children,
	}: {
		title: string
		href?: string
		linkLabel?: string
		class?: string
		bodyClass?: string
		children: Snippet
	} = $props()

	const cell = getWidgetCell()
	const editing = $derived(homeStore.editing)
	let handle = $state<HTMLButtonElement>()

	const STEPS: Record<string, -1 | 1> = { ArrowUp: -1, ArrowLeft: -1, ArrowDown: 1, ArrowRight: 1 }

	function onkeydown(event: KeyboardEvent) {
		const by = STEPS[event.key]
		if (!by) return
		event.preventDefault()
		cell.step(by)
		// Moving re-inserts the widget, which drops focus
		tick().then(() => handle?.focus())
	}

	/** The header is the drag handle (touch too), except its buttons */
	function onheaderdown(event: PointerEvent) {
		if ((event.target as Element).closest('button:not([data-handle])')) return
		cell.drag(event)
	}
</script>

<section
	class={['relative flex h-full min-w-0 flex-col border border-stroke bg-background', className]}
	aria-label={title}
>
	<!-- svelte-ignore a11y_no_static_element_interactions (the grip button is the keyboard handle) -->
	<header
		class={[
			'flex min-h-[2lh] items-center gap-[.5ch] border-b border-stroke px-ch',
			editing && 'cursor-grab touch-none select-none',
		]}
		onpointerdown={editing ? onheaderdown : undefined}
	>
		{#if editing}
			<button
				bind:this={handle}
				class="-ml-[.5ch] grid size-[1.5lh] shrink-0 cursor-grab place-items-center text-green-700 dark:text-accent"
				data-handle
				aria-label="Move {title}"
				title="Drag to move, or use the arrow keys"
				{onkeydown}
			>
				<GripIcon />
			</button>
		{/if}

		<h2 class="grow truncate h4">{title}</h2>

		{#if editing}
			<button
				class="button min-w-[3ch] font-mono text-xs"
				onclick={cell.resize}
				aria-label="Resize {title}, now {WIDGET_SIZE_LABELS[cell.widget.size]}"
				title="Resize"
			>
				{cell.widget.size}
			</button>
			<button class="button" onclick={cell.hide} aria-label="Hide {title}" title="Hide">
				<EyeOffIcon />
			</button>
		{:else if href}
			<a
				{href}
				class="inline-flex shrink-0 items-center gap-[.25ch] text-xs text-current/60 hover-link hover:text-current"
			>
				{linkLabel}
				<ChevronRightIcon class="size-[1.2em]" />
			</a>
		{/if}
	</header>

	<div class={['relative min-h-0 grow', editing && 'opacity-60', bodyClass]} inert={editing}>
		{@render children()}
	</div>

	{#if editing}
		<!-- Mice drag from anywhere; touch only from the header, so the page still scrolls -->
		<div
			class="absolute inset-x-0 top-[2lh] bottom-0 cursor-grab"
			onpointerdown={(event) => event.pointerType === 'mouse' && cell.drag(event)}
			aria-hidden="true"
		></div>
	{/if}
</section>
