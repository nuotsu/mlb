<script lang="ts" module>
	import type { Component } from 'svelte'

	export type Section = { id: string; label: string; icon: Component<Record<string, unknown>> }
</script>

<script lang="ts">
	import { cn } from '#lib/utils.js'
	import { replaceState } from '$app/navigation'
	import { page } from '$app/state'
	import { prefersReducedMotion } from 'svelte/motion'

	let {
		sections,
		label,
	}: {
		/**
		 * Every section the page can render, keyed by the id on its root element, in page order.
		 * The first stands for the top of the page, so its button scrolls back there.
		 */
		sections: Section[]
		/** Accessible name of the nav, e.g. "Game sections" */
		label: string
	} = $props()

	const TOP = $derived(sections[0].id)

	/** Ids of the sections currently rendered, in the order they appear on screen */
	let rendered = $state<string[]>([])
	/** Starts at the top; a writable derived, so taps and scrolling move it */
	let active = $derived(TOP)
	/** Scrolling down tucks the bar away; scrolling up or pausing brings it back */
	let hidden = $state(false)

	const items = $derived([
		sections[0],
		...rendered.flatMap((id) => sections.find((s) => s.id === id) ?? []),
	])
	/** Roving tab stop: the active icon, or the first if the active section just went away */
	const tabStop = $derived(items.some(({ id }) => id === active) ? active : TOP)
	// Not worth a navigator for a page that barely scrolls
	const show = $derived(rendered.length >= 2)

	let wrapper: HTMLElement
	let toolbar = $state<HTMLElement>()
	const buttons: Record<string, HTMLButtonElement> = $state({})

	/** The tapped section, which wins ties with others in the same row until it scrolls off */
	let pinned: string | null = null
	/** Set while a tap's smooth scroll is in flight, so passing sections don't flash active */
	let jumping = false
	let settle: ReturnType<typeof setTimeout> | undefined

	function behavior(): ScrollBehavior {
		return prefersReducedMotion.current ? 'instant' : 'smooth'
	}

	function measure() {
		return sections
			.slice(1)
			.flatMap(({ id }) => {
				const el = document.getElementById(id)
				// No client rects when `display: none`, e.g. an empty card
				if (!el?.getClientRects().length) return []
				const { top, bottom, left } = el.getBoundingClientRect()
				return [{ id, el, top, bottom, left }]
			})
			.sort((a, b) => (Math.abs(a.top - b.top) < 2 ? a.left - b.left : a.top - b.top))
	}

	function update(scroller: HTMLElement) {
		const measured = measure()
		const ids = measured.map((s) => s.id)
		if (ids.join() !== rendered.join()) rendered = ids

		if (jumping) return

		const view = scroller.getBoundingClientRect()
		const header = scroller.querySelector(':scope > header')?.getBoundingClientRect().bottom
		const visibleTop = Math.max(view.top, header ?? view.top)
		// A section is "current" once its top passes a third of the way down the visible area
		const line = visibleTop + (view.bottom - visibleTop) / 3
		const { scrollTop, scrollHeight, clientHeight } = scroller
		const atBottom = scrollTop > 0 && scrollTop + clientHeight >= scrollHeight - 2

		let next = TOP
		if (scrollTop < 1) {
			next = TOP
		} else if (atBottom) {
			// Short sections at the end never reach the line, so take the last one in view
			const inView = measured.filter((s) => s.top < view.bottom && s.bottom > visibleTop)
			next = inView.some((s) => s.id === pinned) ? pinned! : (inView.at(-1)?.id ?? TOP)
		} else {
			const passed = measured.filter((s) => s.top <= line)
			const last = passed.at(-1)
			// Side-by-side sections share a top, so take the leftmost
			const current = last && passed.find((s) => Math.abs(s.top - last.top) < 2)
			if (current) next = current.id

			// Keep the tapped section while it still spans the line, even if a section beside it
			// starts a little lower; only a section nested inside it takes over. One too short to ever
			// reach the line (e.g. an empty pitch arsenal) holds on until it scrolls off the top
			const tapped = measured.find((s) => s.id === pinned)
			const short = tapped && tapped.bottom - tapped.top < line - visibleTop
			if (
				tapped &&
				tapped.top <= line &&
				tapped.bottom > (short ? visibleTop : line) &&
				!tapped.el.contains(current!.el)
			)
				next = tapped.id
		}

		if (next !== pinned) pinned = null
		active = next
	}

	function go(id: string) {
		const scroller = wrapper.closest('main')
		if (!scroller) return

		pinned = id
		active = id
		hidden = false
		jumping = true
		clearTimeout(settle)
		settle = setTimeout(() => (jumping = false), 200)

		// Scroll `main` itself: `scrollIntoView` also scrolls any ancestor that can, and when the
		// section can't reach the top (the last one), that shifts the whole app up
		const el = id === TOP ? null : document.getElementById(id)
		const top = el
			? el.getBoundingClientRect().top -
				scroller.getBoundingClientRect().top +
				scroller.scrollTop -
				parseFloat(getComputedStyle(el).scrollMarginTop)
			: 0
		scroller.scrollTo({ top, behavior: behavior() })

		const url = new URL(page.url.href)
		url.hash = id === TOP ? '' : id
		replaceState(url, page.state)
	}

	function onkeydown(e: KeyboardEvent) {
		const i = items.findIndex(({ id }) => buttons[id] === document.activeElement)
		const next = {
			ArrowRight: (i + 1) % items.length,
			ArrowDown: (i + 1) % items.length,
			ArrowLeft: (i - 1 + items.length) % items.length,
			ArrowUp: (i - 1 + items.length) % items.length,
			Home: 0,
			End: items.length - 1,
		}[e.key]
		if (next == null) return

		e.preventDefault()
		const button = buttons[items[next].id]
		// Same reason as above; slide the icon into view within the bar instead
		button?.focus({ preventScroll: true })
		if (button) center(button)
	}

	/** Scroll the bar sideways (it overflows on narrow screens) to center an icon */
	function center(button: HTMLButtonElement) {
		toolbar?.scrollTo({
			left: button.offsetLeft - (toolbar.clientWidth - button.offsetWidth) / 2,
			behavior: behavior(),
		})
	}

	$effect(() => {
		const scroller = wrapper.closest('main')
		if (!scroller) return

		const hash = decodeURIComponent(location.hash.slice(1))
		if (sections.some((s) => s.id === hash)) pinned = hash

		let frame = 0
		const schedule = () => {
			if (!frame) frame = requestAnimationFrame(() => ((frame = 0), update(scroller)))
		}

		let lastScrollTop = scroller.scrollTop
		let idle: ReturnType<typeof setTimeout> | undefined

		function onscroll() {
			if (jumping) {
				// Hold the tapped section until the smooth scroll settles
				clearTimeout(settle)
				settle = setTimeout(() => ((jumping = false), schedule()), 150)
			}

			const { scrollTop, scrollHeight, clientHeight } = scroller!
			const delta = scrollTop - lastScrollTop
			lastScrollTop = scrollTop

			// iOS momentum overshoots the ends: scrollTop goes negative (or past the max) and springs
			// back, which would read as scrolling the other way, so the ends always show the bar
			const atTop = scrollTop <= 1
			const atBottom = scrollTop + clientHeight >= scrollHeight - 2
			// Only keyboard focus holds the bar open; a tapped button keeps focus too
			const focused = !!wrapper.querySelector(':focus-visible')
			if (atTop || atBottom || focused || jumping || delta < -2) hidden = false
			else if (delta > 2) hidden = true

			clearTimeout(idle)
			idle = setTimeout(() => (hidden = false), 800)

			schedule()
		}

		// Sections come and go as data loads, updates, or switches views
		const observer = new MutationObserver(schedule)
		observer.observe(scroller, { childList: true, subtree: true })

		scroller.addEventListener('scroll', onscroll, { passive: true })
		window.addEventListener('resize', schedule)
		schedule()

		return () => {
			observer.disconnect()
			scroller.removeEventListener('scroll', onscroll)
			window.removeEventListener('resize', schedule)
			cancelAnimationFrame(frame)
			clearTimeout(idle)
			clearTimeout(settle)
		}
	})

	// Keep the active icon in view
	$effect(() => {
		const button = buttons[active]
		if (show && button) center(button)
	})
</script>

<div
	bind:this={wrapper}
	class={cn(
		'pointer-events-none sticky bottom-0 z-10 flex justify-center px-ch',
		show && 'pb-[max(1ch,env(safe-area-inset-bottom))]',
	)}
>
	{#if show}
		<nav
			aria-label={label}
			class={cn(
				'pointer-events-auto max-w-full min-w-0 rounded-full border border-foreground/15 bg-background/70 text-foreground shadow-lg backdrop-blur-md transition-[translate,opacity] duration-300 motion-reduce:transition-none',
				hidden && 'pointer-events-none translate-y-[calc(100%+1ch)] opacity-0',
			)}
			onfocusin={() => (hidden = false)}
		>
			<div
				bind:this={toolbar}
				role="toolbar"
				aria-label="Jump to section"
				aria-orientation="horizontal"
				tabindex="-1"
				class="relative isolate no-scrollbar flex gap-0.5 overflow-x-auto overscroll-x-contain rounded-full p-0.5"
				{onkeydown}
			>
				<!-- One highlight, anchored to the active icon, so it slides between them -->
				<span
					class="nav-highlight pointer-events-none absolute -z-1 rounded-full bg-accent"
					style:position-anchor="--section-nav-{active}"
					aria-hidden="true"
				></span>

				{#each items as { id, label, icon: Icon } (id)}
					{@const selected = active === id}
					<button
						bind:this={buttons[id]}
						type="button"
						aria-label={label}
						title={label}
						aria-current={selected ? 'location' : undefined}
						tabindex={id === tabStop ? 0 : -1}
						style:anchor-name="--section-nav-{id}"
						class={cn(
							'grid size-9 shrink-0 place-items-center rounded-full transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset',
							selected
								? 'text-dark focus-visible:ring-foreground'
								: 'text-foreground/60 pointer-fine:hover:bg-accent/25 pointer-fine:hover:text-foreground',
						)}
						onclick={() => go(id)}
					>
						<Icon class="size-[1.125rem]" aria-hidden="true" />
					</button>
				{/each}
			</div>
		</nav>
	{/if}
</div>

<style>
	.nav-highlight {
		top: anchor(top);
		right: anchor(right);
		bottom: anchor(bottom);
		left: anchor(left);
		transition: inset 250ms var(--ease-out);

		@media (prefers-reduced-motion: reduce) {
			transition: none;
		}
	}

	/* Without anchor positioning, the active icon carries the highlight itself */
	@supports not (anchor-name: --a) {
		.nav-highlight {
			display: none;
		}

		[aria-current='location'] {
			background-color: var(--color-accent);
		}
	}
</style>
