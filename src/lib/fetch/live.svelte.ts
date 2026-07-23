import { HOST } from '$ui/playground/constants'

export function fetchLiveMLB<T>(
	endpoint: string,
	params?: Fetch.Params,
	options: { interval?: number } = {
		interval: 3_000,
	},
) {
	const url = new URL(endpoint, HOST)

	for (const [key, value] of Object.entries(params ?? {})) {
		url.searchParams.set(key, typeof value !== 'string' ? value!?.flat().join(',') : value)
	}

	let data = $state<T | undefined>(undefined)
	let error = $state<Error | undefined>(undefined)
	let isValidating = $state(false)

	const isLoading = $derived(isValidating && data === undefined)

	async function revalidate() {
		isValidating = true

		try {
			const response = await fetch(url.toString())
			data = (await response.json()) as T
			error = undefined
		} catch (e) {
			error = e instanceof Error ? e : new Error(String(e))
		} finally {
			isValidating = false
		}
	}

	revalidate()

	const timer = options.interval ? setInterval(revalidate, options.interval) : undefined

	$effect(() => {
		return () => {
			if (timer) clearInterval(timer)
		}
	})

	return {
		get data() {
			return data
		},
		get error() {
			return error
		},
		get isLoading() {
			return isLoading
		},
		get isValidating() {
			return isValidating
		},
		refresh: revalidate,
		stop: () => clearInterval(timer),
	}
}
