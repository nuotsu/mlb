import { flatten, search, type JsonTable } from './table'

export type WorkerRequest =
	| { id: number; type: 'parse'; text: string }
	| { id: number; type: 'search'; query: string }
	| { id: number; type: 'stringify'; node: number }

export type WorkerResponse =
	| { id: number; type: 'parse'; table: JsonTable; parseMs: number; flattenMs: number }
	| { id: number; type: 'search'; matches: Int32Array }
	| { id: number; type: 'stringify'; text: string }
	| { id: number; type: 'error'; message: string }

export type ParseResult = Extract<WorkerResponse, { type: 'parse' }>

type Pending = { resolve: (r: WorkerResponse) => void; reject: (e: unknown) => void }

let worker: Worker | null = null
/** Set when the worker can't start or crashed; everything then runs on the main thread */
let unsupported = typeof Worker === 'undefined'
let seq = 0
let parsing: number | null = null
const pending = new Map<number, Pending>()

/** Main-thread fallback for browsers without module workers */
let local: { root: unknown; table: JsonTable } | null = null

class WorkerCrash extends Error {}

function spawn() {
	if (worker || unsupported) return worker

	try {
		worker = new Worker(new URL('./json.worker.ts', import.meta.url), { type: 'module' })
	} catch {
		unsupported = true
		return null
	}

	worker.addEventListener('message', (event: MessageEvent<WorkerResponse>) => {
		const job = pending.get(event.data.id)
		if (!job) return
		pending.delete(event.data.id)
		if (parsing === event.data.id) parsing = null
		if (event.data.type === 'error') job.reject(new Error(event.data.message))
		else job.resolve(event.data)
	})

	worker.addEventListener('error', (event) => {
		event.preventDefault()
		unsupported = true
		restart(new WorkerCrash(event.message || 'JSON worker failed'))
	})

	return worker
}

/** Kill the worker (and anything it was doing) */
function restart(reason: unknown) {
	worker?.terminate()
	worker = null
	parsing = null
	for (const job of pending.values()) job.reject(reason)
	pending.clear()
}

/** Boot the worker ahead of time (Send hover/focus) so the first parse doesn't pay for it */
export function warmJsonWorker() {
	spawn()
}

function call<T extends WorkerResponse['type']>(
	message: Omit<Extract<WorkerRequest, { type: T }>, 'id'>,
): Promise<Extract<WorkerResponse, { type: T }>> {
	const w = spawn()!
	const id = ++seq
	if (message.type === 'parse') parsing = id
	return new Promise((resolve, reject) => {
		pending.set(id, { resolve: resolve as Pending['resolve'], reject })
		w.postMessage({ ...message, id })
	})
}

export async function parseJson(text: string): Promise<ParseResult> {
	// JSON.parse can't be interrupted; a newer response simply replaces the worker
	if (parsing !== null) restart(new DOMException('Superseded by a newer response', 'AbortError'))

	if (spawn()) {
		try {
			return await call<'parse'>({ type: 'parse', text })
		} catch (e) {
			if (!(e instanceof WorkerCrash)) throw e
		}
	}

	const t0 = performance.now()
	const root = JSON.parse(text)
	const t1 = performance.now()
	const table = flatten(root)
	local = { root, table }
	return { id: 0, type: 'parse', table, parseMs: t1 - t0, flattenMs: performance.now() - t1 }
}

export async function searchJson(query: string): Promise<Int32Array> {
	if (!spawn()) return local ? search(local.table, query) : new Int32Array(0)
	return (await call<'search'>({ type: 'search', query })).matches
}

/** Pretty JSON for node `node` (0 = the whole response) */
export async function stringifyJson(node: number): Promise<string> {
	if (!spawn()) {
		if (!local) return ''
		let value: unknown = local.root
		const t = local.table
		const chain: number[] = []
		for (let i = node; i > 0; i = t.parent[i]) chain.push(i)
		for (const i of chain.reverse()) {
			value = Array.isArray(value)
				? value[t.index[i]]
				: (value as Record<string, unknown>)[t.keys.slice(t.keyOff[i], t.keyOff[i + 1])]
		}
		return JSON.stringify(value, null, 2)
	}
	return (await call<'stringify'>({ type: 'stringify', node })).text
}
