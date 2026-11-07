import type { HomeWidget } from '#lib/home.js'
import { createContext } from 'svelte'

/** What a widget's frame can do with its slot in the grid (edit mode) */
export type WidgetCell = {
	readonly widget: HomeWidget
	/** Start dragging from a press */
	drag(event: PointerEvent): void
	/** Move one place earlier or later (keyboard) */
	step(by: -1 | 1): void
	resize(): void
	hide(): void
}

export const [getWidgetCell, setWidgetCell] = createContext<WidgetCell>()
