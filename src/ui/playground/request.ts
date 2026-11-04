import { CUSTOM_ENDPOINT_KEY, CUSTOM_ENDPOINT_PATH, ENDPOINTS, HOST } from './constants'

/** Same-origin pass-through to statsapi.mlb.com (see src/routes/api/proxy/[...path]/+server.ts) */
export const PROXY_PREFIX = '/api/proxy'

/** Header the playground sends so the proxy's PostHog event joins the visitor's person */
export const DISTINCT_ID_HEADER = 'x-playground-distinct-id'

/** Only these Stats API versions are proxied or linked */
export const ALLOWED_PREFIXES = ['/api/v1/', '/api/v1.1/'] as const

/** Strings, though `<input type=number>` bindings hand back numbers (or null when empty) */
export type ParamValues = Record<string, string | number | null | undefined>

const text = (value: ParamValues[string]) => (value == null ? '' : String(value).trim())

export interface ResolvedRequest {
	/** `/api/v1/...` with path params filled in */
	path: string
	/** `?a=1&b=2` with empty params dropped (what MLB receives), or '' */
	query: string
	/** `path + query`, the "endpoint" users copy */
	endpoint: string
	/** `https://statsapi.mlb.com` + endpoint */
	mlbUrl: string
	/** Playground deep link that reproduces this request when opened */
	pageUrl: string
	/** Same-origin URL the browser fetches */
	proxyUrl: string
	/** Path params left empty; the request can't be sent until they're filled */
	missing: string[]
	valid: boolean
}

export function defaultValue(parameter: string, values?: Docs.EndpointParamProps[]) {
	if (parameter === CUSTOM_ENDPOINT_KEY.slice(2, -1)) return CUSTOM_ENDPOINT_PATH
	const first = values?.[0]
	return !first || first.empty ? '' : first.value
}

/** Defaults for every param of an endpoint, overridden by whatever the URL provided */
export function initialValues(
	endpointKey: string,
	initialParams: Record<string, string> = {},
): ParamValues {
	const config = ENDPOINTS[endpointKey]
	const values: ParamValues = {}

	for (const group of [config?.pathParams, config?.queryParams]) {
		for (const [parameter, presets] of Object.entries(group ?? {})) {
			values[parameter] = initialParams[parameter] ?? defaultValue(parameter, presets)
		}
	}

	return values
}

/** encodeURIComponent, but keep the separators MLB uses readable in the address bar */
export function encodeQueryValue(value: string) {
	return encodeURIComponent(value).replace(/%2C/gi, ',').replace(/%3A/gi, ':')
}

function toQuery(pairs: [string, string][]) {
	if (!pairs.length) return ''
	return '?' + pairs.map(([k, v]) => `${encodeURIComponent(k)}=${encodeQueryValue(v)}`).join('&')
}

export function isAllowedPath(path: string) {
	return ALLOWED_PREFIXES.some((prefix) => path.startsWith(prefix))
}

export function toProxyUrl(endpoint: string) {
	return PROXY_PREFIX + endpoint.replace(/^\/api/, '')
}

export function resolveRequest(endpointKey: string, values: ParamValues): ResolvedRequest {
	if (endpointKey === CUSTOM_ENDPOINT_KEY) {
		return resolveCustom(text(values.custom))
	}

	const config = ENDPOINTS[endpointKey] ?? {}
	const missing: string[] = []
	let path = endpointKey

	for (const parameter of Object.keys(config.pathParams ?? {})) {
		const value = text(values[parameter])
		if (!value) missing.push(parameter)
		path = path.replace(`{${parameter}}`, encodeURIComponent(value))
	}

	const sent: [string, string][] = []
	const shared: [string, string][] = []

	for (const [parameter, presets] of Object.entries(config.queryParams ?? {})) {
		const value = text(values[parameter])

		if (value) {
			sent.push([parameter, value])
			shared.push([parameter, value])
		} else if (defaultValue(parameter, presets)) {
			// Cleared on purpose: keep `key=` in the deep link so reopening it doesn't refill the default
			shared.push([parameter, ''])
		}
	}

	const query = toQuery(sent)
	const endpoint = path + query

	return {
		path,
		query,
		endpoint,
		mlbUrl: HOST + endpoint,
		pageUrl: path + toQuery(shared),
		proxyUrl: toProxyUrl(endpoint),
		missing,
		valid: !missing.length && isAllowedPath(path),
	}
}

function resolveCustom(input: string): ResolvedRequest {
	const raw = input.trim().replace(/^(?!\/)/, '/')
	const [rawPath, rawSearch = ''] = raw.split(/\?(.*)/s, 2)
	const params = new URLSearchParams(rawSearch)
	const sent = [...params].filter(([, v]) => v !== '')
	const query = toQuery(sent)
	const endpoint = rawPath + query

	return {
		path: rawPath,
		query,
		endpoint,
		mlbUrl: HOST + endpoint,
		// Keep empty params (`fields=`) so a known endpoint reopened from this link doesn't refill defaults
		pageUrl: rawPath + (rawSearch ? `?${rawSearch}` : ''),
		proxyUrl: toProxyUrl(endpoint),
		missing: [],
		// The bare version root (`/api/v1/`) is the playground's landing state, not a request
		valid: isAllowedPath(rawPath) && !/^\/api\/v[\d.]+\/?$/.test(rawPath),
	}
}
