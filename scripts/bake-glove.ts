/**
 * Bakes the homepage's ASCII baseball glove (`src/lib/baseball-glove.ts`) from a 3D scan into
 * `src/lib/baseball-glove-data.ts`: its signed distance sampled on a grid, and what each sample
 * near the surface is nearest to (black or maroon leather, lace, printing, or the hand opening).
 *
 * The scan is "Baseball Glove" by Lead Black Tech (https://sketchfab.com/drebond), licensed
 * CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). Download its glTF binary (.glb) from
 * https://sketchfab.com/3d-models/baseball-glove-35b2e174e07047f4a7d3442b5ed921c0, then run
 *
 *     bun scripts/bake-glove.ts path/to/baseball-glove.glb
 */

import { deflateRawSync, inflateSync } from 'node:zlib'

const [glbPath, outPath = 'src/lib/baseball-glove-data.ts'] = process.argv.slice(2)
if (!glbPath) {
	console.error('usage: bun scripts/bake-glove.ts path/to/baseball-glove.glb [out.ts]')
	process.exit(1)
}

// --- Settings (keep `src/lib/baseball-glove.ts` in step) ---

/** Grid spacing, in object radii (the glove is scaled to just fit the unit sphere). */
const VOXEL = 0.025
/** How far out the farthest point of the leather sits. */
const FILL = 0.95
/** Where the dangling ends of the laces are cut off. */
const CLIP = 0.99
/** Distances are stored in steps of this… */
const STEP = VOXEL / 8
/** …out to this many steps (two voxels) either side of the surface. */
const LIMIT = 16
/** Voxels of empty grid around the glove. */
const PAD = 2
/**
 * How many voxels out from each triangle's bounding box distances are measured: a sample any
 * farther out is farther than this from it, so distances up to this are exact.
 */
const BAND = 3

/**
 * Turns the scan (which stands on its wrist on a stand) so its pocket faces +z and its fingers
 * point up +y, with the thumb toward −x: a glove for a left hand, seen from the front.
 */
const TURN = [
	['y', Math.PI / 2],
	['x', -0.9],
	['z', Math.PI / 2],
] as const

/** Kinds of surface, by texture color. The order matches the glove's materials. */
const BLACK = 0,
	MAROON = 1,
	LACE = 2,
	PRINT = 3,
	OPENING = 4
const KINDS = 5
/** How much of the surface around a sample has to be lace to draw it as lace. */
const LACE_SHARE = 0.45

// --- Reading the scan ---

interface Scan {
	/** World-space positions. */
	positions: Float64Array
	uvs: Float32Array
	indices: Uint32Array
	texture: { width: number; height: number; rgb: Uint8Array }
}

async function readGlb(path: string): Promise<Scan> {
	const bytes = new Uint8Array(await Bun.file(path).arrayBuffer())
	const view = new DataView(bytes.buffer)
	if (view.getUint32(0, true) !== 0x46546c67) throw new Error('not a .glb')
	const jsonLength = view.getUint32(12, true)
	const gltf = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + jsonLength)))
	const bin = bytes.subarray(20 + jsonLength + 8)

	function read(index: number) {
		const accessor = gltf.accessors[index]
		const bufferView = gltf.bufferViews[accessor.bufferView]
		const size = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[accessor.type as string]!
		const Type = {
			5126: Float32Array,
			5125: Uint32Array,
			5123: Uint16Array,
			5121: Uint8Array,
		}[accessor.componentType as number]!
		const stride = bufferView.byteStride ? bufferView.byteStride / Type.BYTES_PER_ELEMENT : size
		const offset = bin.byteOffset + (bufferView.byteOffset ?? 0) + (accessor.byteOffset ?? 0)
		const source = new Type(
			bin.buffer.slice(offset, offset + accessor.count * stride * Type.BYTES_PER_ELEMENT),
		)
		const out = new Float64Array(accessor.count * size)
		for (let i = 0; i < accessor.count; i++)
			for (let c = 0; c < size; c++) out[i * size + c] = source[i * stride + c]
		return { data: out, count: accessor.count as number }
	}

	// Column-major 4×4 matrices, as glTF stores them
	const multiply = (a: number[], b: number[]) => {
		const r = new Array(16).fill(0)
		for (let i = 0; i < 4; i++)
			for (let j = 0; j < 4; j++)
				for (let k = 0; k < 4; k++) r[j * 4 + i] += a[k * 4 + i] * b[j * 4 + k]
		return r
	}
	const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
	const placed: { mesh: number; matrix: number[] }[] = []
	function walk(index: number, parent: number[]) {
		const node = gltf.nodes[index]
		if (node.translation || node.rotation || node.scale) throw new Error('TRS nodes not handled')
		const matrix = multiply(parent, node.matrix ?? identity)
		if (node.mesh !== undefined) placed.push({ mesh: node.mesh, matrix })
		for (const child of node.children ?? []) walk(child, matrix)
	}
	for (const root of gltf.scenes[gltf.scene ?? 0].nodes) walk(root, identity)

	const positions: number[] = [],
		uvs: number[] = [],
		indices: number[] = []
	for (const { mesh, matrix: m } of placed)
		for (const primitive of gltf.meshes[mesh].primitives) {
			const base = positions.length / 3
			const p = read(primitive.attributes.POSITION)
			const uv = read(primitive.attributes.TEXCOORD_0)
			for (let i = 0; i < p.count; i++) {
				const [x, y, z] = p.data.subarray(i * 3, i * 3 + 3)
				positions.push(
					m[0] * x + m[4] * y + m[8] * z + m[12],
					m[1] * x + m[5] * y + m[9] * z + m[13],
					m[2] * x + m[6] * y + m[10] * z + m[14],
				)
				uvs.push(uv.data[i * 2], uv.data[i * 2 + 1])
			}
			for (const i of read(primitive.indices).data) indices.push(base + i)
		}

	const material = gltf.materials[0]
	const textureIndex =
		material.extensions?.KHR_materials_pbrSpecularGlossiness?.diffuseTexture?.index ??
		material.pbrMetallicRoughness?.baseColorTexture?.index
	const image = gltf.images[gltf.textures[textureIndex].source]
	const imageView = gltf.bufferViews[image.bufferView]
	const png = bin.subarray(
		imageView.byteOffset ?? 0,
		(imageView.byteOffset ?? 0) + imageView.byteLength,
	)

	return {
		positions: new Float64Array(positions),
		uvs: new Float32Array(uvs),
		indices: new Uint32Array(indices),
		texture: decodePng(png),
	}
}

/** Decodes an 8-bit RGB or RGBA, non-interlaced PNG to RGB. */
function decodePng(png: Uint8Array) {
	const view = new DataView(png.buffer, png.byteOffset, png.byteLength)
	let width = 0,
		height = 0,
		channels = 0
	const data: Uint8Array[] = []
	for (let at = 8; at < png.length;) {
		const length = view.getUint32(at)
		const type = String.fromCharCode(...png.subarray(at + 4, at + 8))
		const body = png.subarray(at + 8, at + 8 + length)
		if (type === 'IHDR') {
			width = view.getUint32(at + 8)
			height = view.getUint32(at + 12)
			const [depth, color, , , interlace] = body.subarray(8)
			if (depth !== 8 || interlace || (color !== 2 && color !== 6))
				throw new Error(`unsupported PNG (depth ${depth}, color ${color})`)
			channels = color === 6 ? 4 : 3
		} else if (type === 'IDAT') data.push(body)
		at += 12 + length
	}
	const raw = inflateSync(Buffer.concat(data))
	const row = width * channels
	const pixels = new Uint8Array(height * row)
	for (let y = 0; y < height; y++) {
		const filter = raw[y * (row + 1)]
		for (let x = 0; x < row; x++) {
			const value = raw[y * (row + 1) + 1 + x]
			const a = x >= channels ? pixels[y * row + x - channels] : 0
			const b = y ? pixels[(y - 1) * row + x] : 0
			const c = x >= channels && y ? pixels[(y - 1) * row + x - channels] : 0
			let predicted = 0
			if (filter === 1) predicted = a
			else if (filter === 2) predicted = b
			else if (filter === 3) predicted = (a + b) >> 1
			else if (filter === 4) {
				const p = a + b - c
				const pa = Math.abs(p - a),
					pb = Math.abs(p - b),
					pc = Math.abs(p - c)
				predicted = pa <= pb && pa <= pc ? a : pb <= pc ? b : c
			}
			pixels[y * row + x] = (value + predicted) & 255
		}
	}
	const rgb = new Uint8Array(width * height * 3)
	for (let i = 0; i < width * height; i++)
		rgb.set(pixels.subarray(i * channels, i * channels + 3), i * 3)
	return { width, height, rgb }
}

/** What kind of surface a texel shows. */
function kindOf(r: number, g: number, b: number) {
	const luma = 0.299 * r + 0.587 * g + 0.114 * b
	// The red handle of the stand the glove was scanned on, showing in the hand opening
	if (r > 40 && r > 1.9 * g && r > 1.9 * b) return OPENING
	// Laces are a neutral white; the logos are printed in a bluish silver
	if (luma > 130 && b - r < 10) return LACE
	if (luma > 100 && b - r >= 10) return PRINT
	if (r > b + 12 && r > g + 15) return MAROON
	return BLACK
}

// --- Baking ---

const started = performance.now()
const scan = await readGlb(glbPath)
const vertexCount = scan.positions.length / 3
const triangleCount = scan.indices.length / 3
console.log(`${vertexCount} vertices, ${triangleCount} triangles`)

// Turn it to face front
type Mat3 = number[]
const rotation = (axis: string, angle: number): Mat3 => {
	const c = Math.cos(angle),
		s = Math.sin(angle)
	if (axis === 'x') return [1, 0, 0, 0, c, -s, 0, s, c]
	if (axis === 'y') return [c, 0, s, 0, 1, 0, -s, 0, c]
	return [c, -s, 0, s, c, 0, 0, 0, 1]
}
const times = (a: Mat3, b: Mat3) =>
	a.map((_, n) => {
		const i = Math.floor(n / 3),
			j = n % 3
		return a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j]
	})
const turn = TURN.reduce<Mat3>(
	(m, [axis, angle]) => times(rotation(axis, angle), m),
	[1, 0, 0, 0, 1, 0, 0, 0, 1],
)
const points = new Float64Array(vertexCount * 3)
for (let i = 0; i < vertexCount; i++) {
	const x = scan.positions[i * 3],
		y = scan.positions[i * 3 + 1],
		z = scan.positions[i * 3 + 2]
	for (let r = 0; r < 3; r++)
		points[i * 3 + r] = turn[r * 3] * x + turn[r * 3 + 1] * y + turn[r * 3 + 2] * z
}

// Each triangle's kind, from the texel at its middle (they're smaller than texels)
const { width, height, rgb } = scan.texture
const kinds = new Uint8Array(triangleCount)
for (let t = 0; t < triangleCount; t++) {
	const [a, b, c] = scan.indices.subarray(t * 3, t * 3 + 3)
	const u = (scan.uvs[a * 2] + scan.uvs[b * 2] + scan.uvs[c * 2]) / 3
	const v = (scan.uvs[a * 2 + 1] + scan.uvs[b * 2 + 1] + scan.uvs[c * 2 + 1]) / 3
	const x = Math.min(width - 1, Math.floor((u - Math.floor(u)) * width)),
		y = Math.min(height - 1, Math.floor((v - Math.floor(v)) * height))
	const texel = (y * width + x) * 3
	kinds[t] = kindOf(rgb[texel], rgb[texel + 1], rgb[texel + 2])
}

// Center the leather in its smallest bounding sphere and scale that to fit, leaving out the laces:
// their loose ends dangle well past it. That's Bădoiu and Clarkson's iteration, over the points
// farthest out in many directions, since only those can touch the sphere
const leather = new Uint8Array(vertexCount)
for (let t = 0; t < triangleCount; t++)
	if (kinds[t] !== LACE) for (const i of scan.indices.subarray(t * 3, t * 3 + 3)) leather[i] = 1
const extremes = new Set<number>()
for (let n = 0; n < 2000; n++) {
	const z = 1 - (2 * (n + 0.5)) / 2000,
		r = Math.sqrt(1 - z * z),
		a = n * Math.PI * (3 - Math.sqrt(5))
	const dx = r * Math.cos(a),
		dy = r * Math.sin(a)
	let best = -Infinity,
		which = 0
	for (let i = 0; i < vertexCount; i++) {
		if (!leather[i]) continue
		const d = points[i * 3] * dx + points[i * 3 + 1] * dy + points[i * 3 + 2] * z
		if (d > best) {
			best = d
			which = i
		}
	}
	extremes.add(which)
}
const candidates = [...extremes]
const center = [0, 1, 2].map(
	(c) => candidates.reduce((s, i) => s + points[i * 3 + c], 0) / candidates.length,
)
const reach = (i: number) =>
	Math.hypot(
		points[i * 3] - center[0],
		points[i * 3 + 1] - center[1],
		points[i * 3 + 2] - center[2],
	)
for (let n = 1; n <= 20000; n++) {
	const farthest = candidates.reduce((f, i) => (reach(i) > reach(f) ? i : f))
	for (let c = 0; c < 3; c++) center[c] += (points[farthest * 3 + c] - center[c]) / (n + 1)
}
let radius = 0,
	everything = 0
for (let i = 0; i < vertexCount; i++) {
	if (leather[i]) radius = Math.max(radius, reach(i))
	everything = Math.max(everything, reach(i))
}
const size = FILL / radius
for (let i = 0; i < vertexCount; i++)
	for (let c = 0; c < 3; c++) points[i * 3 + c] = (points[i * 3 + c] - center[c]) * size
console.log(`leather reaches ${radius.toFixed(2)} scan units out, laces ${everything.toFixed(2)}`)

// The grid, in voxels from its corner, over what's inside the sphere it's cut off at
const lo = [Infinity, Infinity, Infinity],
	hi = [-Infinity, -Infinity, -Infinity]
for (let i = 0; i < vertexCount; i++)
	for (let c = 0; c < 3; c++) {
		lo[c] = Math.max(-CLIP, Math.min(lo[c], points[i * 3 + c]))
		hi[c] = Math.min(CLIP, Math.max(hi[c], points[i * 3 + c]))
	}
const origin = lo.map((v) => Math.floor(v / VOXEL - PAD) * VOXEL)
const [nx, ny, nz] = hi.map((v, c) => Math.ceil((v - origin[c]) / VOXEL + PAD) + 1)
const dims = [nx, ny, nz]
const count = nx * ny * nz
const at = (i: number, j: number, k: number) => (k * ny + j) * nx + i
console.log(`grid ${nx}×${ny}×${nz}`)
const grid = new Float64Array(vertexCount * 3)
for (let i = 0; i < vertexCount; i++)
	for (let c = 0; c < 3; c++) grid[i * 3 + c] = (points[i * 3 + c] - origin[c]) / VOXEL

/** The voxel nearest the middle of triangle `t`. */
function cellOf(t: number) {
	const [a, b, c] = scan.indices.subarray(t * 3, t * 3 + 3)
	const [i, j, k] = [0, 1, 2].map((d) =>
		Math.round((grid[a * 3 + d] + grid[b * 3 + d] + grid[c * 3 + d]) / 3),
	)
	return at(i, j, k)
}

// How much of each kind of surface passes through each voxel's cell
const coverage = new Float64Array(count * KINDS)
for (let t = 0; t < triangleCount; t++) {
	const [a, b, c] = scan.indices.subarray(t * 3, t * 3 + 3)
	const e1 = [0, 1, 2].map((d) => grid[b * 3 + d] - grid[a * 3 + d]),
		e2 = [0, 1, 2].map((d) => grid[c * 3 + d] - grid[a * 3 + d])
	const area = Math.hypot(
		e1[1] * e2[2] - e1[2] * e2[1],
		e1[2] * e2[0] - e1[0] * e2[2],
		e1[0] * e2[1] - e1[1] * e2[0],
	)
	coverage[cellOf(t) * KINDS + kinds[t]] += area
}

// Exact unsigned distances (in voxels) out to `BAND` around every triangle, and which is nearest
const distance = new Float64Array(count).fill(Infinity)
const nearest = new Int32Array(count).fill(-1)
const q = [0, 0, 0]
/** Squared distance from `q` to triangle `abc` (Ericson, "Real-Time Collision Detection" 5.1.5). */
function toTriangle(a: number, b: number, c: number) {
	const ax = grid[a * 3],
		ay = grid[a * 3 + 1],
		az = grid[a * 3 + 2]
	const abx = grid[b * 3] - ax,
		aby = grid[b * 3 + 1] - ay,
		abz = grid[b * 3 + 2] - az
	const acx = grid[c * 3] - ax,
		acy = grid[c * 3 + 1] - ay,
		acz = grid[c * 3 + 2] - az
	const apx = q[0] - ax,
		apy = q[1] - ay,
		apz = q[2] - az
	const d1 = abx * apx + aby * apy + abz * apz,
		d2 = acx * apx + acy * apy + acz * apz
	let s = 0,
		t = 0
	if (d1 <= 0 && d2 <= 0) {
		// Vertex a
	} else {
		const bpx = apx - abx,
			bpy = apy - aby,
			bpz = apz - abz
		const d3 = abx * bpx + aby * bpy + abz * bpz,
			d4 = acx * bpx + acy * bpy + acz * bpz
		const cpx = apx - acx,
			cpy = apy - acy,
			cpz = apz - acz
		const d5 = abx * cpx + aby * cpy + abz * cpz,
			d6 = acx * cpx + acy * cpy + acz * cpz
		const vc = d1 * d4 - d3 * d2,
			vb = d5 * d2 - d1 * d6,
			va = d3 * d6 - d5 * d4
		if (d3 >= 0 && d4 <= d3) s = 1
		else if (d6 >= 0 && d5 <= d6) t = 1
		else if (vc <= 0 && d1 >= 0 && d3 <= 0) s = d1 / (d1 - d3)
		else if (vb <= 0 && d2 >= 0 && d6 <= 0) t = d2 / (d2 - d6)
		else if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
			t = (d4 - d3) / (d4 - d3 + (d5 - d6))
			s = 1 - t
		} else {
			const denominator = 1 / (va + vb + vc)
			s = vb * denominator
			t = vc * denominator
		}
	}
	const dx = apx - abx * s - acx * t,
		dy = apy - aby * s - acy * t,
		dz = apz - abz * s - acz * t
	return dx * dx + dy * dy + dz * dz
}
for (let t = 0; t < triangleCount; t++) {
	const a = scan.indices[t * 3],
		b = scan.indices[t * 3 + 1],
		c = scan.indices[t * 3 + 2]
	const from = [0, 1, 2].map((d) =>
		Math.max(0, Math.ceil(Math.min(grid[a * 3 + d], grid[b * 3 + d], grid[c * 3 + d]) - BAND)),
	)
	const to = [0, 1, 2].map((d) =>
		Math.min(
			dims[d] - 1,
			Math.floor(Math.max(grid[a * 3 + d], grid[b * 3 + d], grid[c * 3 + d]) + BAND),
		),
	)
	for (let k = from[2]; k <= to[2]; k++)
		for (let j = from[1]; j <= to[1]; j++)
			for (let i = from[0]; i <= to[0]; i++) {
				q[0] = i
				q[1] = j
				q[2] = k
				const d = toTriangle(a, b, c)
				const cell = at(i, j, k)
				if (d < distance[cell]) {
					distance[cell] = d
					nearest[cell] = t
				}
			}
}
for (let i = 0; i < count; i++) distance[i] = Math.sqrt(distance[i])
console.log(`distances ${((performance.now() - started) / 1000).toFixed(1)}s`)

// Inside or out: count the surface crossings along lines of samples on each axis (an odd count
// before a sample puts it inside), and take the majority. The scan has a few small holes; a line
// through one crosses an odd number of times in all, so it abstains.
const votes = new Int8Array(count)
for (let axis = 0; axis < 3; axis++) {
	const [b, c] = [(axis + 1) % 3, (axis + 2) % 3]
	const lines: number[][] = Array.from({ length: dims[b] * dims[c] }, () => [])
	for (let t = 0; t < triangleCount; t++) {
		const v = [0, 1, 2].map((n) => scan.indices[t * 3 + n])
		const pb = v.map((i) => grid[i * 3 + b]),
			pc = v.map((i) => grid[i * 3 + c]),
			pa = v.map((i) => grid[i * 3 + axis])
		const area = (pb[1] - pb[0]) * (pc[2] - pc[0]) - (pc[1] - pc[0]) * (pb[2] - pb[0])
		if (area === 0) continue
		for (let j = Math.ceil(Math.min(...pb)); j <= Math.floor(Math.max(...pb)); j++)
			for (let k = Math.ceil(Math.min(...pc)); k <= Math.floor(Math.max(...pc)); k++) {
				const w0 = ((pb[1] - j) * (pc[2] - k) - (pc[1] - k) * (pb[2] - j)) / area
				const w1 = ((pb[2] - j) * (pc[0] - k) - (pc[2] - k) * (pb[0] - j)) / area
				const w2 = 1 - w0 - w1
				if (w0 <= 0 || w1 <= 0 || w2 <= 0) continue
				lines[k * dims[b] + j].push(w0 * pa[0] + w1 * pa[1] + w2 * pa[2])
			}
	}
	for (let j = 0; j < dims[b]; j++)
		for (let k = 0; k < dims[c]; k++) {
			const crossings = lines[k * dims[b] + j].sort((x, y) => x - y)
			if (crossings.length % 2) continue
			let passed = 0
			for (let i = 0; i < dims[axis]; i++) {
				while (passed < crossings.length && crossings[passed] < i) passed++
				const index = [0, 0, 0]
				index[axis] = i
				index[b] = j
				index[c] = k
				votes[at(index[0], index[1], index[2])] += passed % 2 ? 1 : -1
			}
		}
}

// Spread each cell's coverage over its neighbors (weighted 1, 2, 1 along each axis), so the kind
// of surface changes in patches, not speckles
let smooth = coverage
for (let axis = 0; axis < 3; axis++) {
	const stride = [1, nx, nx * ny][axis] * KINDS
	const next = new Float64Array(count * KINDS)
	for (let n = 0; n < count; n++) {
		const index = [n % nx, Math.floor(n / nx) % ny, Math.floor(n / (nx * ny))][axis]
		for (let kind = 0; kind < KINDS; kind++) {
			const o = n * KINDS + kind
			next[o] =
				2 * smooth[o] +
				(index > 0 ? smooth[o - stride] : 0) +
				(index < dims[axis] - 1 ? smooth[o + stride] : 0)
		}
	}
	smooth = next
}

/** The kind of surface that passes through cell `n` and its neighbors. */
function surfaceOf(n: number) {
	const o = n * KINDS
	const total = smooth.subarray(o, o + KINDS).reduce((s, v) => s + v, 0) || 1
	const share = (kind: number) => smooth[o + kind] / total
	if (share(LACE) >= LACE_SHARE) return LACE
	if (share(OPENING) >= 0.3) return OPENING
	// The logos are too small to make out in type, so they take the leather's color
	return share(MAROON) >= share(BLACK) ? MAROON : BLACK
}

// Signed distances in steps, cut off at the sphere and at `LIMIT` (past that, only which side
// matters here; the glove works out how far it is when it loads), and the kind of surface nearest
// each sample near it
const values = new Int8Array(count)
const surface = new Uint8Array(count)
let inside = 0
for (let n = 0; n < count; n++) {
	const [i, j, k] = [n % nx, Math.floor(n / nx) % ny, Math.floor(n / (nx * ny))]
	const out = Math.hypot(origin[0] + i * VOXEL, origin[1] + j * VOXEL, origin[2] + k * VOXEL) - CLIP
	const signed = Math.max((votes[n] > 0 ? -distance[n] : distance[n]) * VOXEL, out)
	if (signed < 0) inside++
	values[n] = Math.max(-LIMIT, Math.min(LIMIT, Math.round(signed / STEP)))
	if (distance[n] <= 2) surface[n] = surfaceOf(cellOf(nearest[n]))
}
console.log(`${inside} of ${count} samples inside`)

// Distances change smoothly, so store each as the change from the one before it along x
const bytes = new Uint8Array(count * 2)
for (let row = 0; row < ny * nz; row++)
	for (let i = 0; i < nx; i++) {
		const n = row * nx + i
		bytes[n] = (values[n] - (i ? values[n - 1] : 0)) & 255
	}
bytes.set(surface, count)
const packed = deflateRawSync(bytes, { level: 9 }).toString('base64')
console.log(`${count * 2} bytes → ${packed.length} base64`)

const round = (v: number) => Number(v.toFixed(6))
await Bun.write(
	outPath,
	`// Generated by scripts/bake-glove.ts: don't edit. From "Baseball Glove" by Lead Black Tech
// (https://sketchfab.com/drebond), CC BY 4.0: https://sketchfab.com/3d-models/baseball-glove-35b2e174e07047f4a7d3442b5ed921c0

/** Samples along x, y and z, where the first one sits, and how far apart they are (object radii). */
export const SIZE = [${nx}, ${ny}, ${nz}] as const
export const ORIGIN = [${origin.map(round).join(', ')}] as const
export const VOXEL = ${VOXEL}

/** Signed distances are stored in steps of this, out to \`LIMIT\` steps either side. */
export const STEP = ${STEP}
export const LIMIT = ${LIMIT}

/**
 * Deflated, then base64: a byte per sample of signed distance in \`STEP\`s (each the change from
 * the sample before it along x), then a byte per sample for the kind of surface nearest it.
 */
export const DATA =
	'${packed}'
`,
)
console.log(`wrote ${outPath} in ${((performance.now() - started) / 1000).toFixed(1)}s`)
