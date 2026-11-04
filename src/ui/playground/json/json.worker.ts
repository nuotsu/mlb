/// <reference lib="webworker" />
import { flatten, search, type JsonTable } from './table'
import type { WorkerRequest, WorkerResponse } from './worker-client'

/** The document behind the last `parse`, kept here so search/copy never touch the main thread */
let doc: { root: unknown; table: JsonTable; lower?: { keys: string; vals: string } } | null = null

function reply(message: WorkerResponse) {
	postMessage(message)
}

/** Walk from the root to node `i` using the table's parent/index/key columns */
function valueAt(i: number): unknown {
	if (!doc) return undefined
	const { table: t, root } = doc
	const chain: number[] = []
	for (let node = i; node > 0; node = t.parent[node]) chain.push(node)

	let value: unknown = root
	for (let c = chain.length - 1; c >= 0; c--) {
		const node = chain[c]
		value = Array.isArray(value)
			? value[t.index[node]]
			: (value as Record<string, unknown>)[t.keys.slice(t.keyOff[node], t.keyOff[node + 1])]
	}
	return value
}

addEventListener('message', (event: MessageEvent<WorkerRequest>) => {
	const request = event.data

	try {
		switch (request.type) {
			case 'parse': {
				doc = null
				const t0 = performance.now()
				const root = JSON.parse(request.text)
				const t1 = performance.now()
				const table = flatten(root)
				const t2 = performance.now()
				doc = { root, table }
				reply({ id: request.id, type: 'parse', table, parseMs: t1 - t0, flattenMs: t2 - t1 })
				break
			}
			case 'search': {
				if (!doc) return reply({ id: request.id, type: 'search', matches: new Int32Array(0) })
				doc.lower ??= { keys: doc.table.keys.toLowerCase(), vals: doc.table.vals.toLowerCase() }
				const matches = search(doc.table, request.query, doc.lower)
				reply({ id: request.id, type: 'search', matches })
				break
			}
			case 'stringify': {
				reply({
					id: request.id,
					type: 'stringify',
					text: JSON.stringify(valueAt(request.node), null, 2),
				})
				break
			}
		}
	} catch (e) {
		reply({ id: request.id, type: 'error', message: e instanceof Error ? e.message : String(e) })
	}
})
