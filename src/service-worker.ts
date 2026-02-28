/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

const sw = self as unknown as ServiceWorkerGlobalScope

sw.addEventListener('notificationclick', (event) => {
	event.notification.close()

	const url: string | undefined = event.notification.data?.url
	if (!url) return

	event.waitUntil(
		sw.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
			for (const client of clients) {
				if ('focus' in client) return client.focus()
			}
			return sw.clients.openWindow(url)
		}),
	)
})
