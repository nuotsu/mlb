<script lang="ts">
	import type { HomeWidget } from '#lib/home.js'
	import { setWidgetCell } from './context.js'
	import { WIDGETS, type WidgetData } from './widgets/index.js'

	let {
		widget,
		data,
		drag,
		step,
		resize,
		hide,
	}: {
		widget: HomeWidget
		data: WidgetData
		drag: (event: PointerEvent) => void
		step: (by: -1 | 1) => void
		resize: () => void
		hide: () => void
	} = $props()

	setWidgetCell({
		get widget() {
			return widget
		},
		drag: (event) => drag(event),
		step: (by) => step(by),
		resize: () => resize(),
		hide: () => hide(),
	})

	const Widget = $derived(WIDGETS[widget.id].component)
</script>

<Widget {data} />
