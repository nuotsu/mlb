type ViewerModule = typeof import('./json-viewer.svelte')

let viewer: Promise<ViewerModule> | null = null

/** The viewer (and its worker) are only downloaded once a response needs them */
export function loadJsonViewer() {
	viewer ??= import('./json-viewer.svelte').catch((e) => {
		viewer = null
		throw e
	})
	return viewer
}

/** Send hover/focus: fetch the viewer chunk and boot the worker ahead of the response */
export function prefetchJsonViewer() {
	loadJsonViewer().then(
		(module) => module.warm(),
		() => {},
	)
}
