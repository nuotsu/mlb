<script lang="ts">
	import type { Attachment } from 'svelte/attachments'

	let { class: className }: { class?: string } = $props()

	/** Glyphs from faint to dense */
	const RAMP = ' .,:;-=+*#%@'
	/** Brighter than this, glyphs take the accent color */
	const CREST = 0.6
	/** About 30fps is plenty for a background */
	const FRAME_MS = 33
	const MAX_RIPPLES = 28
	/** Cells per second a ring spreads */
	const RING_SPEED = 26
	/** Seconds a ring lasts */
	const RING_LIFE = 3
	/** Seconds between drips while nobody's pointing */
	const IDLE_DRIP = 2.4

	type Ripple = { x: number; y: number; t0: number; amp: number }

	/*
		A slow flowing glyph field under the hero. The pointer lights up the glyphs under it and
		leaves a wake; a tap drops a ring. Left alone, it drips now and then so it reads as
		interactive. One <pre>, written directly (not through Svelte) each frame.
	*/
	const field: Attachment<HTMLPreElement> = (pre) => {
		const host = pre.parentElement
		if (!host) return

		const motion = matchMedia('(prefers-reduced-motion: reduce)')
		let cols = 0
		let rows = 0
		/** Cell height ÷ width, so rings stay round */
		let aspect = 2
		let ripples: Ripple[] = []
		const pointer = { x: 0, y: 0, at: -Infinity, active: false }
		let lastDrop = 0
		let lastDrip = 0
		let visible = true
		let raf = 0
		let last = 0

		const now = () => performance.now() / 1000

		function measure() {
			const probe = document.createElement('span')
			probe.textContent = '0000000000'
			probe.style.cssText = 'position:absolute;visibility:hidden'
			pre.append(probe)
			const width = probe.offsetWidth / 10
			const height = probe.offsetHeight
			probe.remove()
			if (!width || !height) return
			cols = Math.ceil(pre.clientWidth / width)
			rows = Math.ceil(pre.clientHeight / height)
			aspect = height / width
			draw(now())
		}

		function cellAt(e: PointerEvent) {
			const rect = pre.getBoundingClientRect()
			return {
				x: ((e.clientX - rect.left) / rect.width) * cols,
				y: ((e.clientY - rect.top) / rect.height) * rows,
			}
		}

		function draw(t: number) {
			if (!cols || !rows) return
			ripples = ripples.filter((r) => t - r.t0 < RING_LIFE).slice(-MAX_RIPPLES)
			const glow = pointer.active && t - pointer.at < 1.5

			if (!glow && !motion.matches && t - lastDrip > IDLE_DRIP) {
				lastDrip = t
				ripples.push({ x: Math.random() * cols, y: Math.random() * rows, t0: t, amp: 0.55 })
			}

			let html = ''
			let run = ''
			let crest = false
			for (let y = 0; y < rows; y++) {
				for (let x = 0; x < cols; x++) {
					let v =
						0.12 +
						0.09 * Math.sin(x * 0.11 + t * 0.45 + Math.sin(y * 0.23 - t * 0.35) * 1.8) +
						0.06 * Math.cos(y * 0.31 + x * 0.05 - t * 0.6)

					if (glow) {
						const dx = x - pointer.x
						const dy = (y - pointer.y) * aspect
						v += 0.5 * Math.exp(-(dx * dx + dy * dy) / 90)
					}

					for (const r of ripples) {
						const age = t - r.t0
						if (age < 0) continue
						const dx = x - r.x
						const dy = (y - r.y) * aspect
						const k = Math.sqrt(dx * dx + dy * dy) - age * RING_SPEED
						v += r.amp * Math.exp(-(k * k) / 5) * Math.exp(-age * 1.3)
					}

					v = Math.min(0.999, Math.max(0, v))
					const isCrest = v > CREST
					if (isCrest !== crest) {
						html += crest ? `<b>${run}</b>` : run
						run = ''
						crest = isCrest
					}
					run += RAMP[Math.floor(v * RAMP.length)]
				}
				run += '\n'
			}
			pre.innerHTML = html + (crest ? `<b>${run}</b>` : run)
		}

		function loop(ms: number) {
			raf = requestAnimationFrame(loop)
			if (!visible || motion.matches || ms - last < FRAME_MS) return
			last = ms
			draw(ms / 1000)
		}

		function onpointermove(e: PointerEvent) {
			const cell = cellAt(e)
			const t = now()
			const moved = Math.hypot(cell.x - pointer.x, (cell.y - pointer.y) * aspect)
			if (t - lastDrop > 0.09 && moved > 1.5) {
				ripples.push({ ...cell, t0: t, amp: 0.3 })
				lastDrop = t
			}
			Object.assign(pointer, cell, { at: t, active: true })
		}

		function onpointerdown(e: PointerEvent) {
			const cell = cellAt(e)
			const t = now()
			ripples.push({ ...cell, t0: t, amp: 1 }, { ...cell, t0: t + 0.2, amp: 0.6 })
		}

		function onpointerleave() {
			pointer.active = false
		}

		const resize = new ResizeObserver(measure)
		resize.observe(pre)
		const intersection = new IntersectionObserver(([entry]) => (visible = entry.isIntersecting))
		intersection.observe(pre)
		document.fonts?.ready.then(measure)

		host.addEventListener('pointermove', onpointermove)
		host.addEventListener('pointerdown', onpointerdown)
		host.addEventListener('pointerleave', onpointerleave)
		raf = requestAnimationFrame(loop)

		return () => {
			cancelAnimationFrame(raf)
			resize.disconnect()
			intersection.disconnect()
			host.removeEventListener('pointermove', onpointermove)
			host.removeEventListener('pointerdown', onpointerdown)
			host.removeEventListener('pointerleave', onpointerleave)
		}
	}
</script>

<pre
	{@attach field}
	class={[
		'pointer-events-none absolute inset-0 -z-10 m-0 overflow-clip font-mono text-[12px] leading-none whitespace-pre text-current/20 select-none',
		className,
	]}
	aria-hidden="true"></pre>

<style>
	pre :global(b) {
		font-weight: inherit;
		color: color-mix(in srgb, var(--color-accent) 70%, var(--color-foreground));
	}
</style>
