import { DISTINCT_ID_HEADER, type ResolvedRequest } from './request'

/** A little over the proxy's own 10s upstream timeout, so the proxy's 504 normally wins */
const CLIENT_TIMEOUT_MS = 12_000

export interface RunResult {
	request: ResolvedRequest
	status: number
	statusText: string
	ok: boolean
	/** Request start to last byte, in ms */
	ms: number
	/** Decoded body size in bytes */
	bytes: number
	text: string
}

export interface RunError {
	kind: 'http' | 'timeout' | 'network' | 'cancelled'
	status?: number
	message: string
}

/** Fetches the playground's requests through the proxy; one at a time, newest wins */
export class Runner {
	status = $state<'idle' | 'loading' | 'done' | 'error'>('idle')
	/** What's loading or was last loaded */
	request = $state.raw<ResolvedRequest | null>(null)
	result = $state.raw<RunResult | null>(null)
	error = $state.raw<RunError | null>(null)

	#controller: AbortController | null = null

	constructor(loading = false) {
		// A deep link renders its skeleton from SSR on, so nothing moves when the request starts
		if (loading) this.status = 'loading'
	}

	get loading() {
		return this.status === 'loading'
	}

	async run(request: ResolvedRequest, distinctId?: string) {
		this.#controller?.abort()
		const controller = new AbortController()
		this.#controller = controller

		this.status = 'loading'
		this.request = request
		this.result = null
		this.error = null

		let timedOut = false
		const timer = setTimeout(() => {
			timedOut = true
			controller.abort()
		}, CLIENT_TIMEOUT_MS)

		const start = performance.now()

		try {
			const response = await fetch(request.proxyUrl, {
				signal: controller.signal,
				headers: distinctId ? { [DISTINCT_ID_HEADER]: distinctId } : undefined,
			})
			const buffer = await response.arrayBuffer()
			const ms = performance.now() - start

			if (controller !== this.#controller) return

			const result: RunResult = {
				request,
				status: response.status,
				statusText: response.statusText,
				ok: response.ok,
				ms,
				bytes: buffer.byteLength,
				text: new TextDecoder().decode(buffer),
			}

			this.result = result

			if (response.ok) {
				this.status = 'done'
			} else {
				this.error = {
					kind: response.status === 504 ? 'timeout' : 'http',
					status: response.status,
					message: errorMessage(result),
				}
				this.status = 'error'
			}
		} catch (e) {
			if (controller !== this.#controller) return

			this.error = timedOut
				? { kind: 'timeout', message: `No response after ${CLIENT_TIMEOUT_MS / 1000}s.` }
				: controller.signal.aborted
					? { kind: 'cancelled', message: 'Request cancelled.' }
					: {
							kind: 'network',
							message: `Network error: ${e instanceof Error ? e.message : e}. Check your connection and try again.`,
						}
			this.status = 'error'
		} finally {
			clearTimeout(timer)
			if (controller === this.#controller) this.#controller = null
		}
	}

	/** Cancel the in-flight request (shows a "cancelled" state) */
	abort() {
		this.#controller?.abort()
	}

	/** Drop everything, e.g. when switching endpoints */
	reset() {
		const controller = this.#controller
		this.#controller = null
		controller?.abort()
		this.status = 'idle'
		this.request = null
		this.result = null
		this.error = null
	}
}

/** MLB errors look like `{ "messageNumber": 10, "message": "Object not found", ... }` */
function errorMessage({ text, status, statusText }: RunResult) {
	try {
		const body = JSON.parse(text)
		if (typeof body?.message === 'string') return body.message
	} catch {
		// not JSON
	}
	return statusText || `HTTP ${status}`
}
