<script lang="ts">
	// @reference https://alexharri.com/blog/ascii-rendering

	import { colorSchemeStore } from '$ui/store.svelte'
	import type { HTMLAttributes } from 'svelte/elements'

	type Vec3 = [number, number, number]
	type Mat3 = [number, number, number, number, number, number, number, number, number]

	let { ...props }: HTMLAttributes<HTMLElement> = $props()

	let containerWidth = $state(0)

	const cols = $derived(Math.floor(Math.min(containerWidth / 7, 80)))
	const rows = $derived(Math.floor(cols * 0.5))

	// Ball orientation as rotation matrix (row-major) — start at random orientation
	let ballMat: Mat3 = (() => {
		const a = Math.random() * Math.PI * 2
		const b = Math.random() * Math.PI * 2
		return matMul(axisAngleMat(1, 0, 0, a), axisAngleMat(0, 1, 0, b))
	})()

	let isDragging = $state(false)
	let activePointerId = -1
	let velocityX = (Math.random() - 0.5) * 0.8
	let velocityY = (Math.random() - 0.5) * 0.8
	let lastPointerX = 0
	let lastPointerY = 0
	let lastPointerTime = 0

	let asciiFrame = $state('')
	let charVectors: { char: string; vec: number[] }[] = []
	let quantCache = new Map<number, string>()

	// --- Vector math ---

	function dot(a: Vec3, b: Vec3): number {
		return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
	}

	function normalize(v: Vec3): Vec3 {
		const len = Math.sqrt(dot(v, v))
		return len > 0 ? [v[0] / len, v[1] / len, v[2] / len] : [0, 0, 0]
	}

	// --- Matrix math ---

	function matMul(a: Mat3, b: Mat3): Mat3 {
		return [
			a[0] * b[0] + a[1] * b[3] + a[2] * b[6],
			a[0] * b[1] + a[1] * b[4] + a[2] * b[7],
			a[0] * b[2] + a[1] * b[5] + a[2] * b[8],
			a[3] * b[0] + a[4] * b[3] + a[5] * b[6],
			a[3] * b[1] + a[4] * b[4] + a[5] * b[7],
			a[3] * b[2] + a[4] * b[5] + a[5] * b[8],
			a[6] * b[0] + a[7] * b[3] + a[8] * b[6],
			a[6] * b[1] + a[7] * b[4] + a[8] * b[7],
			a[6] * b[2] + a[7] * b[5] + a[8] * b[8],
		]
	}

	function matTVec(m: Mat3, v: Vec3): Vec3 {
		return [
			m[0] * v[0] + m[3] * v[1] + m[6] * v[2],
			m[1] * v[0] + m[4] * v[1] + m[7] * v[2],
			m[2] * v[0] + m[5] * v[1] + m[8] * v[2],
		]
	}

	function axisAngleMat(ax: number, ay: number, az: number, angle: number): Mat3 {
		const c = Math.cos(angle),
			s = Math.sin(angle),
			t = 1 - c
		return [
			t * ax * ax + c,
			t * ax * ay - s * az,
			t * ax * az + s * ay,
			t * ax * ay + s * az,
			t * ay * ay + c,
			t * ay * az - s * ax,
			t * ax * az - s * ay,
			t * ay * az + s * ax,
			t * az * az + c,
		]
	}

	function reortho(m: Mat3): Mat3 {
		let x: Vec3 = [m[0], m[1], m[2]]
		let y: Vec3 = [m[3], m[4], m[5]]
		x = normalize(x)
		const d = dot(x, y)
		y = normalize([y[0] - d * x[0], y[1] - d * x[1], y[2] - d * x[2]])
		const z: Vec3 = [
			x[1] * y[2] - x[2] * y[1],
			x[2] * y[0] - x[0] * y[2],
			x[0] * y[1] - x[1] * y[0],
		]
		return [x[0], x[1], x[2], y[0], y[1], y[2], z[0], z[1], z[2]]
	}

	// --- Baseball seam distance ---

	const SEAM_POINTS: Vec3[] = []
	{
		const steps = 128
		const TILT = 0.42
		const ct = Math.cos(TILT),
			st = Math.sin(TILT)

		for (let i = 0; i < steps; i++) {
			const t = (i / steps) * Math.PI * 4
			const x = Math.cos(t)
			const y0 = Math.sin(t)
			const y = y0 * ct
			const z = y0 * st
			const ca = Math.cos(t / 2),
				sa = Math.sin(t / 2)
			SEAM_POINTS.push([x * ca + z * sa, y, -x * sa + z * ca])
		}
	}

	function seamDistance(p: Vec3): number {
		const n = normalize(p)
		let minDist = Infinity
		for (const s of SEAM_POINTS) {
			const dx = n[0] - s[0],
				dy = n[1] - s[1],
				dz = n[2] - s[2]
			const d = dx * dx + dy * dy + dz * dz
			if (d < minDist) minDist = d
		}
		return Math.sqrt(minDist)
	}

	// --- Single ray → lightness ---

	function computeLightness(u: number, v: number): number {
		const RADIUS = 0.9
		const lightDir: Vec3 = normalize([0.15, 0.25, -1])
		const viewDir: Vec3 = [0, 0, -1]

		const rayOz = -2
		const c = u * u + v * v + rayOz * rayOz - RADIUS * RADIUS
		const disc = rayOz * rayOz - c

		if (disc < 0) return 0

		const t = -rayOz - Math.sqrt(disc)
		const hit: Vec3 = [u, v, rayOz + t]
		const normal: Vec3 = normalize(hit)

		// Transform to ball-local space for seam lookup only
		const rp: Vec3 = matTVec(ballMat, hit)

		// Lighting in fixed world space
		const diffuse = Math.max(0, dot(normal, lightDir))

		const half: Vec3 = normalize([
			lightDir[0] - viewDir[0],
			lightDir[1] - viewDir[1],
			lightDir[2] - viewDir[2],
		])
		const spec = Math.pow(Math.max(0, dot(normal, half)), 32) * 0.3

		const rim = Math.pow(1 - Math.max(0, -dot(normal, viewDir)), 3) * 0.2

		// Seam
		const sd = seamDistance(rp)
		const seamW = 0.16
		const seamFactor = sd < seamW ? 0.3 + 0.7 * (sd / seamW) : 1.0

		const lightness = Math.min(1, (0.4 + diffuse * 0.5 + spec + rim) * seamFactor)
		return colorSchemeStore.mode === 'light' ? 1 - lightness : lightness * 0.5
	}

	// --- Pre-compute character shape vectors ---

	function precomputeCharVectors(): { char: string; vec: number[] }[] {
		const chars = " .`'^,:;Il!i><~+_-?][}{1)(|/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$"
		const canvas = document.createElement('canvas')
		const ctx = canvas.getContext('2d')!
		const cellW = 12
		const cellH = 24
		canvas.width = cellW
		canvas.height = cellH

		const samples: [number, number][] = [
			[0.25, 0.17],
			[0.75, 0.17],
			[0.25, 0.5],
			[0.75, 0.5],
			[0.25, 0.83],
			[0.75, 0.83],
		]
		const r = 3

		return [...chars].map((char) => {
			ctx.clearRect(0, 0, cellW, cellH)
			ctx.fillStyle = 'white'
			ctx.font = `${cellH - 2}px "Geist Mono", monospace`
			ctx.textBaseline = 'top'
			ctx.fillText(char, 0, 0)

			const imgData = ctx.getImageData(0, 0, cellW, cellH)
			const vec = samples.map(([sx, sy]) => {
				let sum = 0,
					count = 0
				const cx = Math.floor(sx * cellW)
				const cy = Math.floor(sy * cellH)
				for (let dy = -r; dy <= r; dy++) {
					for (let dx = -r; dx <= r; dx++) {
						if (dx * dx + dy * dy > r * r) continue
						const px = cx + dx,
							py = cy + dy
						if (px < 0 || px >= cellW || py < 0 || py >= cellH) continue
						sum += imgData.data[(py * cellW + px) * 4 + 3]
						count++
					}
				}
				return count > 0 ? sum / count / 255 : 0
			})

			return { char, vec }
		})
	}

	// --- Character matching with quantization cache ---

	function quantize(v: number[]): number {
		let key = 0
		for (let i = 0; i < 6; i++) {
			const q = Math.round(Math.min(1, Math.max(0, v[i])) * 31)
			key = (key << 5) | q
		}
		return key
	}

	function findChar(cellVec: number[]): string {
		const key = quantize(cellVec)
		const cached = quantCache.get(key)
		if (cached !== undefined) return cached

		const maxVal = Math.max(...cellVec)
		if (maxVal < 0.01) {
			quantCache.set(key, ' ')
			return ' '
		}

		const isDark = colorSchemeStore.mode !== 'light'
		const enhanced = isDark ? cellVec : cellVec.map((v) => Math.pow(v / maxVal, 1.4) * maxVal)

		let bestChar = ' '
		let bestDist = Infinity
		for (const { char, vec } of charVectors) {
			let dist = 0
			for (let i = 0; i < 6; i++) {
				const d = enhanced[i] - vec[i]
				dist += d * d
			}
			if (dist < bestDist) {
				bestDist = dist
				bestChar = char
			}
		}

		quantCache.set(key, bestChar)
		return bestChar
	}

	// --- Render a full frame ---

	function renderFrame(): string {
		if (cols <= 0 || rows <= 0) return ''

		const subOffsets: [number, number][] = [
			[-0.25, -0.3],
			[0.25, -0.3],
			[-0.25, 0.0],
			[0.25, 0.0],
			[-0.25, 0.3],
			[0.25, 0.3],
		]

		const lines: string[] = []

		for (let row = 0; row < rows; row++) {
			let line = ''
			for (let col = 0; col < cols; col++) {
				const cellVec = subOffsets.map(([du, dv]) => {
					const u = ((col + 0.5 + du) / cols) * 2 - 1
					const v = -(((row + 0.5 + dv) / rows) * 2 - 1)
					return computeLightness(u, v)
				})

				line += findChar(cellVec)
			}
			lines.push(line)
		}

		return lines.join('\n')
	}

	// --- Lifecycle ---

	$effect(() => {
		colorSchemeStore.mode
		quantCache = new Map()
	})

	$effect(() => {
		document.fonts.load('22px "Geist Mono"').then(() => {
			charVectors = precomputeCharVectors()
		})
	})

	$effect(() => {
		let animFrame = 0
		let lastTime = 0
		let frames = 0

		function animate(time: number) {
			const dt = lastTime ? (time - lastTime) / 1000 : 0
			lastTime = time

			if (!isDragging) {
				const speed = Math.sqrt(velocityX * velocityX + velocityY * velocityY)
				if (speed > 0.001) {
					const angle = speed * dt
					ballMat = matMul(axisAngleMat(velocityX / speed, velocityY / speed, 0, angle), ballMat)

					const friction = Math.pow(0.2, dt)
					velocityX *= friction
					velocityY *= friction

					// Enforce min speed in the current spin direction
					const newSpeed = Math.sqrt(velocityX * velocityX + velocityY * velocityY)
					const MIN_SPEED = 0.3
					if (newSpeed < MIN_SPEED && newSpeed > 0.001) {
						const scale = MIN_SPEED / newSpeed
						velocityX *= scale
						velocityY *= scale
					}
				}
			}

			if (++frames % 60 === 0) ballMat = reortho(ballMat)

			asciiFrame = renderFrame()
			animFrame = requestAnimationFrame(animate)
		}

		animFrame = requestAnimationFrame(animate)
		return () => cancelAnimationFrame(animFrame)
	})

	// --- Pointer interaction ---

	function onpointerdown(e: PointerEvent) {
		if (activePointerId !== -1) return
		activePointerId = e.pointerId
		isDragging = true
		lastPointerX = e.clientX
		lastPointerY = e.clientY
		lastPointerTime = performance.now()
		velocityX = 0
		velocityY = 0
		;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
	}

	function onpointermove(e: PointerEvent) {
		if (!isDragging || e.pointerId !== activePointerId) return
		const dx = e.clientX - lastPointerX
		const dy = e.clientY - lastPointerY

		const angleX = -dy * 0.01
		const angleY = -dx * 0.01
		ballMat = matMul(axisAngleMat(0, 1, 0, angleY), matMul(axisAngleMat(1, 0, 0, angleX), ballMat))

		const now = performance.now()
		const dt = (now - lastPointerTime) / 1000
		if (dt > 0) {
			velocityX = angleX / dt
			velocityY = angleY / dt
		}
		lastPointerX = e.clientX
		lastPointerY = e.clientY
		lastPointerTime = now
	}

	function onpointerup(e: PointerEvent) {
		if (e.pointerId !== activePointerId) return
		activePointerId = -1
		isDragging = false
	}
</script>

<figure {...props} bind:clientWidth={containerWidth}>
	<pre
		class="place-content-centercursor-grab grid aspect-square touch-none place-content-center font-mono leading-none tracking-tighter select-none active:cursor-grabbing"
		{onpointerdown}
		{onpointermove}
		{onpointerup}
		role="img"
		aria-label="Interactive 3D baseball rendered in ASCII art">{asciiFrame}</pre>
</figure>
