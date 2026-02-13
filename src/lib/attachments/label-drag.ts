import type { Attachment } from 'svelte/attachments'

export function labelDrag(): Attachment {
	return (element) => {
		function handleTouchMove(e: TouchEvent) {
			const touch = e.touches[0]
			const target = document.elementFromPoint(touch.clientX, touch.clientY)
			const input = target?.closest('label')?.querySelector('input')
			if (input) input.checked = true
		}

		const el = element as HTMLElement

		el.addEventListener('touchmove', handleTouchMove)

		return () => {
			el.removeEventListener('touchmove', handleTouchMove)
		}
	}
}
