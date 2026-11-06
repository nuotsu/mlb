<script lang="ts">
	import {
		moveId,
		resolveWidgets,
		SIZE_SPANS,
		widgetElementId,
		type HomeWidgetId,
	} from '#lib/home.js'
	import { PencilLineIcon } from '#ui/icons/index.js'
	import { flushSync, onMount } from 'svelte'
	import { flip } from 'svelte/animate'
	import type { Attachment } from 'svelte/attachments'
	import Cell from './cell.svelte'
	import { homeStore } from './store.svelte.js'
	import { WIDGETS, type WidgetData } from './widgets/index.js'

	let { data }: { data: WidgetData } = $props()

	/*
		The server renders the default layout. The saved one (localStorage) takes over once
		mounted; before that, `homeLayoutScript` shows it as CSS from the first paint.
	*/
	let mounted = $state(false)
	onMount(() => {
		mounted = true
		document.getElementById('home-layout')?.remove()
	})

	const widgets = $derived(mounted ? homeStore.widgets : resolveWidgets())
	const visible = $derived(widgets.filter((w) => !w.hidden))
	const hidden = $derived(widgets.filter((w) => w.hidden))
	const editing = $derived(homeStore.editing)

	/* Drag and drop: the dragged widget follows the pointer while the others make room */

	/** Order while dragging; committed on drop */
	let order = $state<HomeWidgetId[] | null>(null)
	const shown = $derived(
		order ? order.flatMap((id) => visible.filter((w) => w.id === id)) : visible,
	)

	let dragging = $state<HomeWidgetId | null>(null)
	/** Dropped, gliding into its slot */
	let settling = $state<HomeWidgetId | null>(null)
	/** The dragged (or settling) widget's offset from its slot */
	let offset = $state({ x: 0, y: 0 })
	let announcement = $state('')
	let editBarHeight = $state(0)

	let grid = $state<HTMLElement>()
	const cells = new Map<HomeWidgetId, HTMLElement>()
	const pointer = { id: -1, x: 0, y: 0, grabX: 0, grabY: 0 }
	let lastOver: HomeWidgetId | null = null
	let movedAt = 0
	let raf = 0
	let settleTimer: ReturnType<typeof setTimeout> | undefined

	/** Wait this long between moves, so a widget that slides under the pointer doesn't bounce back */
	const MOVE_COOLDOWN_MS = 140
	/** Auto-scroll when the pointer is this close to the scroller's edge */
	const SCROLL_EDGE = 64

	const register =
		(id: HomeWidgetId): Attachment<HTMLElement> =>
		(element) => {
			cells.set(id, element)
			return () => {
				if (cells.get(id) === element) cells.delete(id)
			}
		}

	function label(id: HomeWidgetId) {
		return WIDGETS[id].label
	}

	function startDrag(event: PointerEvent, id: HomeWidgetId) {
		if (dragging || (event.pointerType === 'mouse' && event.button !== 0)) return
		const element = cells.get(id)
		if (!element) return
		event.preventDefault()

		const rect = element.getBoundingClientRect()
		Object.assign(pointer, {
			id: event.pointerId,
			x: event.clientX,
			y: event.clientY,
			grabX: event.clientX - rect.left,
			grabY: event.clientY - rect.top,
		})
		clearTimeout(settleTimer)
		settling = null
		lastOver = null
		order = visible.map((w) => w.id)
		dragging = id
		announcement = `Picked up ${label(id)}.`
		raf = requestAnimationFrame(frame)
	}

	function frame() {
		raf = requestAnimationFrame(frame)
		const id = dragging
		if (!id || !grid || !order) return

		autoScroll()

		// Layout positions (offsetLeft/Top) ignore transforms, so the sliding widgets don't jitter this
		const box = grid.getBoundingClientRect()
		const x = pointer.x - box.left
		const y = pointer.y - box.top

		let over: HomeWidgetId | null = null
		for (const other of order) {
			const cell = other !== id && cells.get(other)
			if (!cell) continue
			const { offsetLeft: left, offsetTop: top, offsetWidth: width, offsetHeight: height } = cell
			if (x >= left && x < left + width && y >= top && y < top + height) {
				over = other
				break
			}
		}

		if (over !== lastOver && performance.now() - movedAt > MOVE_COOLDOWN_MS) {
			lastOver = over
			if (over) {
				order = moveId(order, id, order.indexOf(over))
				movedAt = performance.now()
				// Lay out the new order now, so the offset below is measured against the new slot
				flushSync()
			}
		}

		const element = cells.get(id)
		if (element) {
			offset = {
				x: x - pointer.grabX - element.offsetLeft,
				y: y - pointer.grabY - element.offsetTop,
			}
		}
	}

	function autoScroll() {
		const scroller = grid?.closest('main')
		if (!scroller) return
		const { top, bottom } = scroller.getBoundingClientRect()
		const by =
			pointer.y < top + SCROLL_EDGE
				? pointer.y - (top + SCROLL_EDGE)
				: pointer.y > bottom - SCROLL_EDGE
					? pointer.y - (bottom - SCROLL_EDGE)
					: 0
		if (by) scroller.scrollTop += Math.max(-20, Math.min(20, by / 3))
	}

	function onpointermove(event: PointerEvent) {
		if (!dragging || event.pointerId !== pointer.id) return
		pointer.x = event.clientX
		pointer.y = event.clientY
	}

	function drop(event: PointerEvent) {
		if (!dragging || event.pointerId !== pointer.id) return
		finish(true)
	}

	function finish(commit: boolean) {
		cancelAnimationFrame(raf)
		const id = dragging!
		const moved = !!order && order.join() !== visible.map((w) => w.id).join()
		if (commit && moved) homeStore.reorder(order!)
		order = null
		dragging = null

		announcement = commit
			? `Dropped ${label(id)} at ${visible.findIndex((w) => w.id === id) + 1} of ${visible.length}.`
			: `Cancelled. ${label(id)} is back in place.`

		// Snap: glide from where it was let go into its slot
		settling = id
		requestAnimationFrame(() => (offset = { x: 0, y: 0 }))
		settleTimer = setTimeout(() => (settling = null), 250)
	}

	function onkeydown(event: KeyboardEvent) {
		if (event.key !== 'Escape') return
		if (dragging) finish(false)
		else if (editing) homeStore.editing = false
	}

	function step(id: HomeWidgetId, by: -1 | 1) {
		const ids = visible.map((w) => w.id)
		const next = moveId(ids, id, ids.indexOf(id) + by)
		if (next === ids) return
		homeStore.reorder(next)
		announcement = `${label(id)} moved to ${next.indexOf(id) + 1} of ${next.length}.`
	}

	function hide(id: HomeWidgetId) {
		homeStore.update(id, { hidden: true })
		announcement = `${label(id)} hidden.`
	}

	function show(id: HomeWidgetId) {
		homeStore.update(id, { hidden: false })
		announcement = `${label(id)} added back.`
	}
</script>

<svelte:window {onpointermove} onpointerup={drop} onpointercancel={drop} {onkeydown} />

<div class="home space-y-lh">
	{#if editing}
		<div
			bind:clientHeight={editBarHeight}
			class="sticky top-0 z-20 flex flex-wrap items-center gap-x-ch gap-y-[.5ch] bg-accent px-ch py-[.5ch] text-sm text-black"
		>
			<!-- Clears the sidebar toggle on phones, like the breadcrumbs -->
			<p class="mr-auto max-sm:ml-[1.25rlh]">Drag widgets to rearrange. Changes save as you go.</p>
			<button class="action-tertiary border-black/30" onclick={() => homeStore.reset()}>
				Reset
			</button>
			<button class="action-tertiary border-black/30" onclick={() => (homeStore.editing = false)}>
				Done
			</button>
		</div>
	{:else}
		<div class="flex justify-end">
			<button class="button text-sm" onclick={() => (homeStore.editing = true)}>
				<PencilLineIcon />
				Edit home
			</button>
		</div>
	{/if}

	<div
		bind:this={grid}
		class={['widgets', dragging && 'select-none']}
		data-home-grid
		data-editing={editing || undefined}
		style:--edit-bar-height={editing ? `${editBarHeight}px` : undefined}
	>
		{#each shown as widget (widget.id)}
			{@const span = SIZE_SPANS[widget.size]}
			{@const lifted = widget.id === dragging || widget.id === settling}

			<div
				class={['cell', widget.id === dragging && 'dragging', widget.id === settling && 'settling']}
				id={widgetElementId(widget.id)}
				data-home-widget={widget.id}
				style:--w={span.cols}
				style:--h={span.rows}
				style:translate={lifted ? `${offset.x}px ${offset.y}px` : undefined}
				animate:flip={{ duration: widget.id === dragging ? 0 : 200 }}
				{@attach register(widget.id)}
			>
				<Cell
					{widget}
					{data}
					drag={(event) => startDrag(event, widget.id)}
					step={(by) => step(widget.id, by)}
					resize={() => homeStore.resize(widget.id)}
					hide={() => hide(widget.id)}
				/>
			</div>
		{/each}
	</div>

	{#if editing && hidden.length}
		<div class="flex flex-wrap items-center gap-[.5ch] text-sm">
			<span class="text-current/60">Hidden:</span>
			{#each hidden as widget (widget.id)}
				<button
					class="rounded-full border border-dashed border-accent px-ch py-[.25ch] hover:bg-accent/25"
					onclick={() => show(widget.id)}
				>
					+ {label(widget.id)}
				</button>
			{/each}
		</div>
	{/if}

	<p class="sr-only" aria-live="polite">{announcement}</p>
</div>

<style>
	.home {
		container: home / inline-size;
	}

	.widgets {
		--cols: 1;
		position: relative;
		display: grid;
		grid-template-columns: repeat(var(--cols), minmax(0, 1fr));
		grid-auto-flow: dense;
		gap: 1lh 2ch;
	}

	@container home (width >= 36rem) {
		.widgets {
			--cols: 2;
		}
	}

	@container home (width >= 60rem) {
		.widgets {
			--cols: 4;
		}

		.cell {
			grid-row: span var(--h, 1);
		}
	}

	.cell {
		min-width: 0;
		grid-column: span min(var(--w, 1), var(--cols));
		scroll-margin-top: 1ch;
	}

	/* Land below the sticky edit bar */
	[data-editing] .cell {
		scroll-margin-top: calc(var(--edit-bar-height, 0px) + 1ch);
	}

	.dragging,
	.settling {
		position: relative;
		z-index: 10;
	}

	.dragging {
		cursor: grabbing;
		scale: 1.02;
		box-shadow: 0 1ch 3ch rgb(0 0 0 / 0.35);
		transition: scale 150ms;
	}

	.settling {
		transition:
			translate 200ms cubic-bezier(0.2, 0.8, 0.2, 1),
			scale 200ms;
	}

	[data-editing] .cell:not(.dragging) {
		outline: 1px dashed var(--color-accent);
		outline-offset: 2px;
	}
</style>
