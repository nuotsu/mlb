/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />
/// <reference types="@sveltejs/kit" />

import { build, files, version } from '$service-worker'

const sw = globalThis.self as unknown as ServiceWorkerGlobalScope

const CACHE = `cache-${version}`
const API_CACHE = `api-${version}`

const ASSETS = [...build, ...files]

sw.addEventListener('install', (event) => {
	async function addFilesToCache() {
		const cache = await caches.open(CACHE)
		await cache.addAll(ASSETS)
	}

	event.waitUntil(addFilesToCache())
})

sw.addEventListener('activate', (event) => {
	async function deleteOldCaches() {
		for (const key of await caches.keys()) {
			if (key !== CACHE && key !== API_CACHE) {
				await caches.delete(key)
			}
		}
	}

	event.waitUntil(deleteOldCaches())
})

sw.addEventListener('fetch', (event) => {
	if (event.request.method !== 'GET') return

	const url = new URL(event.request.url)

	// MLB API requests: network-first with cache fallback
	if (url.hostname === 'statsapi.mlb.com') {
		event.respondWith(networkFirst(event.request, API_CACHE))
		return
	}

	// Static assets: cache-first
	if (ASSETS.includes(url.pathname)) {
		event.respondWith(cacheFirst(event.request))
		return
	}

	// Navigation and other requests: network-first with offline fallback
	event.respondWith(networkFirst(event.request, CACHE))
})

async function cacheFirst(request: Request) {
	const cache = await caches.open(CACHE)
	const cached = await cache.match(request)

	return cached ?? fetch(request)
}

async function networkFirst(request: Request, cacheName: string) {
	const cache = await caches.open(cacheName)

	try {
		const response = await fetch(request)

		if (!(response instanceof Response)) {
			throw new Error('invalid response from fetch')
		}

		if (response.status === 200) {
			cache.put(request, response.clone())
		}

		return response
	} catch {
		const cached = await cache.match(request)

		if (cached) return cached

		// Offline fallback for navigation requests
		if (request.mode === 'navigate') {
			return new Response(OFFLINE_HTML, {
				status: 503,
				headers: { 'Content-Type': 'text/html; charset=utf-8' },
			})
		}

		return new Response('Offline', { status: 503 })
	}
}

const OFFLINE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="utf-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	<title>Offline — MLB</title>
	<style>
		* { margin: 0; box-sizing: border-box; }
		body {
			font-family: system-ui, -apple-system, sans-serif;
			background: #000;
			color: #fff;
			display: grid;
			place-content: center;
			min-height: 100dvh;
			text-align: center;
			padding: 2rem;
		}
		h1 { font-size: 1.5rem; margin-bottom: .5rem; }
		p { color: #888; }
	</style>
</head>
<body>
	<div>
		<h1>You're offline</h1>
		<p>Previously visited pages may still be available.</p>
	</div>
</body>
</html>`
