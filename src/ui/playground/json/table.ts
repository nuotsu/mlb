/**
 * A parsed JSON document flattened into parallel typed arrays, one entry per node in document
 * (pre-order) order. Built once in a worker; the viewer only ever reads it.
 *
 * Node `i`'s subtree is `i..end[i]-1`, so skipping a collapsed node is `i = end[i]`.
 */
export interface JsonTable {
	n: number
	/** One of the `T_*` constants */
	type: Uint8Array
	depth: Uint16Array
	/** -1 for the root */
	parent: Int32Array
	/** Exclusive end of the node's subtree */
	end: Int32Array
	/** Child count for objects/arrays */
	size: Int32Array
	/** Position within the parent (the array index for array items) */
	index: Int32Array
	/** 1-based line in the fully expanded, 2-space pretty-printed JSON */
	line: Int32Array
	/** Line of the closing bracket, 0 when there is none (leaves, `{}`, `[]`) */
	closeLine: Int32Array
	/** Object keys, concatenated; node i's key is keys.slice(keyOff[i], keyOff[i + 1]) */
	keys: string
	keyOff: Int32Array
	/** Leaf values as text (strings unquoted/unescaped), concatenated like `keys` */
	vals: string
	valOff: Int32Array
	/** Total lines when fully expanded */
	lines: number
	/** Open + close rows when fully expanded (upper bound for a visible row list) */
	maxRows: number
}

export const T_OBJECT = 0
export const T_ARRAY = 1
export const T_STRING = 2
export const T_NUMBER = 3
export const T_BOOLEAN = 4
export const T_NULL = 5

export const isContainer = (t: JsonTable, i: number) => t.type[i] <= T_ARRAY

export const keyOf = (t: JsonTable, i: number) => t.keys.slice(t.keyOff[i], t.keyOff[i + 1])

export const valueOf = (t: JsonTable, i: number) => t.vals.slice(t.valOff[i], t.valOff[i + 1])

export function flatten(root: unknown): JsonTable {
	let cap = 1024
	let type = new Uint8Array(cap)
	let depth = new Uint16Array(cap)
	let parent = new Int32Array(cap)
	let end = new Int32Array(cap)
	let size = new Int32Array(cap)
	let index = new Int32Array(cap)
	let line = new Int32Array(cap)
	let closeLine = new Int32Array(cap)
	let keyOff = new Int32Array(cap + 1)
	let valOff = new Int32Array(cap + 1)

	const keyParts: string[] = []
	const valParts: string[] = []
	let keyLength = 0
	let valLength = 0
	let n = 0
	let ln = 0
	let closeRows = 0

	function grow() {
		cap *= 2
		const resize = <A extends Uint8Array | Uint16Array | Int32Array>(a: A, size = cap): A => {
			const next = new (a.constructor as new (length: number) => A)(size)
			next.set(a)
			return next
		}
		type = resize(type)
		depth = resize(depth)
		parent = resize(parent)
		end = resize(end)
		size = resize(size)
		index = resize(index)
		line = resize(line)
		closeLine = resize(closeLine)
		keyOff = resize(keyOff, cap + 1)
		valOff = resize(valOff, cap + 1)
	}

	function visit(value: unknown, key: string | null, d: number, p: number, idx: number) {
		if (n === cap) grow()
		const i = n++

		depth[i] = d
		parent[i] = p
		index[i] = idx
		line[i] = ++ln
		keyOff[i] = keyLength
		valOff[i] = valLength

		if (key) {
			keyParts.push(key)
			keyLength += key.length
		}

		const leaf = (t: number, text: string) => {
			type[i] = t
			valParts.push(text)
			valLength += text.length
		}

		if (value === null || value === undefined) {
			leaf(T_NULL, 'null')
		} else if (Array.isArray(value)) {
			type[i] = T_ARRAY
			size[i] = value.length
			for (let j = 0; j < value.length; j++) visit(value[j], null, d + 1, i, j)
			if (value.length) {
				closeLine[i] = ++ln
				closeRows++
			}
		} else {
			switch (typeof value) {
				case 'string':
					leaf(T_STRING, value)
					break
				case 'number':
					leaf(T_NUMBER, Number.isFinite(value) ? String(value) : 'null')
					break
				case 'boolean':
					leaf(T_BOOLEAN, value ? 'true' : 'false')
					break
				case 'object': {
					type[i] = T_OBJECT
					const keys = Object.keys(value)
					size[i] = keys.length
					for (let j = 0; j < keys.length; j++) {
						visit((value as Record<string, unknown>)[keys[j]], keys[j], d + 1, i, j)
					}
					if (keys.length) {
						closeLine[i] = ++ln
						closeRows++
					}
					break
				}
				default:
					leaf(T_NULL, 'null')
			}
		}

		end[i] = n
	}

	visit(root, null, 0, -1, 0)
	keyOff[n] = keyLength
	valOff[n] = valLength

	return {
		n,
		type: type.slice(0, n),
		depth: depth.slice(0, n),
		parent: parent.slice(0, n),
		end: end.slice(0, n),
		size: size.slice(0, n),
		index: index.slice(0, n),
		line: line.slice(0, n),
		closeLine: closeLine.slice(0, n),
		keys: keyParts.join(''),
		keyOff: keyOff.slice(0, n + 1),
		vals: valParts.join(''),
		valOff: valOff.slice(0, n + 1),
		lines: ln,
		maxRows: n + closeRows,
	}
}

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/

/** JS-style accessor path, e.g. `dates[0].games[3].gamePk` (empty for the root) */
export function pathOf(t: JsonTable, i: number) {
	let path = ''

	for (let node = i; t.parent[node] >= 0; node = t.parent[node]) {
		const p = t.parent[node]

		if (t.type[p] === T_ARRAY) {
			path = `[${t.index[node]}]` + path
		} else {
			const key = keyOf(t, node)
			path = (IDENTIFIER.test(key) ? `.${key}` : `[${JSON.stringify(key)}]`) + path
		}
	}

	return path.replace(/^\./, '')
}

/** Which containers are folded: collapsed when `depth >= depthLimit`, flipped for ids in `toggled` */
export interface Folding {
	depthLimit: number
	toggled: Set<number>
}

export function isCollapsed(t: JsonTable, i: number, folding: Folding) {
	return (
		t.type[i] <= T_ARRAY &&
		t.size[i] > 0 &&
		t.depth[i] >= folding.depthLimit !== folding.toggled.has(i)
	)
}

export function setCollapsed(t: JsonTable, i: number, collapsed: boolean, folding: Folding) {
	if (isCollapsed(t, i, folding) === collapsed) return
	if (folding.toggled.has(i)) folding.toggled.delete(i)
	else folding.toggled.add(i)
}

/** Unfold every ancestor of `i` so it becomes visible; returns whether anything changed */
export function revealNode(t: JsonTable, i: number, folding: Folding) {
	let changed = false
	for (let p = t.parent[i]; p >= 0; p = t.parent[p]) {
		if (isCollapsed(t, p, folding)) {
			setCollapsed(t, p, false, folding)
			changed = true
		}
	}
	return changed
}

/**
 * Visible rows for the current folding. Each entry is a node id (its opening/only line) or
 * `~id` (negative) for the line holding a container's closing bracket.
 *
 * With `marks` (1 = search match, 2 = ancestor of a match) only matches and their ancestors show;
 * ancestors are forced open, matched containers keep their own folding.
 */
export function buildRows(t: JsonTable, folding: Folding, marks?: Uint8Array | null) {
	const rows = new Int32Array(t.maxRows)
	let m = 0

	function normal(i: number) {
		rows[m++] = i
		if (t.type[i] > T_ARRAY || !t.size[i] || isCollapsed(t, i, folding)) return
		for (let c = i + 1; c < t.end[i]; c = t.end[c]) normal(c)
		rows[m++] = ~i
	}

	function filtered(i: number) {
		const mark = marks![i]
		if (!mark) return
		if (mark & 1) return normal(i)
		rows[m++] = i
		for (let c = i + 1; c < t.end[i]; c = t.end[c]) filtered(c)
		rows[m++] = ~i
	}

	if (t.n) (marks ? filtered : normal)(0)

	return rows.subarray(0, m)
}

/** 1 for matches, 2 for their ancestors */
export function markMatches(t: JsonTable, matches: Int32Array) {
	const marks = new Uint8Array(t.n)

	for (const i of matches) {
		marks[i] |= 1
		for (let p = t.parent[i]; p >= 0 && !(marks[p] & 2); p = t.parent[p]) marks[p] |= 2
	}

	return marks
}

/** Node ids whose key or leaf value contains `query` (case-insensitive), in document order */
export function search(t: JsonTable, query: string, lower?: { keys: string; vals: string }) {
	const q = query.toLowerCase()
	if (!q) return new Int32Array(0)

	const keys = lower?.keys ?? t.keys.toLowerCase()
	const vals = lower?.vals ?? t.vals.toLowerCase()
	const hits = new Uint8Array(t.n)

	// toLowerCase can change length for a few characters; offsets would drift, so scan per node
	const scan = (text: string, original: string, offsets: Int32Array) => {
		if (text.length !== original.length) {
			for (let i = 0; i < t.n; i++) {
				if (
					original
						.slice(offsets[i], offsets[i + 1])
						.toLowerCase()
						.includes(q)
				)
					hits[i] = 1
			}
			return
		}

		for (let at = text.indexOf(q); at !== -1; at = text.indexOf(q, at + 1)) {
			const i = nodeAt(offsets, at, t.n)
			if (at + q.length <= offsets[i + 1]) hits[i] = 1
		}
	}

	scan(keys, t.keys, t.keyOff)
	scan(vals, t.vals, t.valOff)

	let count = 0
	for (let i = 0; i < t.n; i++) count += hits[i]

	const matches = new Int32Array(count)
	for (let i = 0, m = 0; i < t.n; i++) if (hits[i]) matches[m++] = i

	return matches
}

/**
 * Last node whose text starts at or before `position` (binary search over an offset table).
 * Nodes with no text share their offset with the next node, so "last" lands on the owner.
 */
function nodeAt(offsets: Int32Array, position: number, n: number) {
	let lo = 0
	let hi = n - 1

	while (lo < hi) {
		const mid = (lo + hi + 1) >> 1
		if (offsets[mid] <= position) lo = mid
		else hi = mid - 1
	}

	return lo
}

/** A leaf's value as JSON text (`"str"`, `12`, `true`, `null`) */
export function leafJson(t: JsonTable, i: number) {
	const value = valueOf(t, i)
	return t.type[i] === T_STRING ? JSON.stringify(value) : value
}
