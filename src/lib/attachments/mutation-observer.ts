import type { Attachment } from 'svelte/attachments'

export function mutationObserver(
	callback: (mutation: MutationRecord) => void,
	options: MutationObserverInit = { childList: true, subtree: true },
): Attachment {
	return (element) => {
		let observer = new MutationObserver((mutationList) => {
			for (const mutation of mutationList) {
				callback(mutation)
			}
		})

		observer.observe(element, options)

		return () => observer.disconnect()
	}
}
