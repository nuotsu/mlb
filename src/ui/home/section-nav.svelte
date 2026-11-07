<script lang="ts">
	import { HOME_WIDGETS, widgetElementId } from '#lib/home.js'
	import { HomePlateIcon } from '#ui/icons/index.js'
	import SectionNav, { type Section } from '#ui/section-nav.svelte'
	import { WIDGETS } from './widgets/index.js'

	/*
		Every widget. The nav only shows the ones on the page, in the order they appear, so it
		follows your layout: hidden widgets drop out and moved ones move with it.
	*/
	const SECTIONS: Section[] = [
		{ id: 'top', label: 'Home', icon: HomePlateIcon },
		...HOME_WIDGETS.map((id) => ({
			id: widgetElementId(id),
			label: WIDGETS[id].label,
			icon: WIDGETS[id].icon,
		})),
	]
</script>

<SectionNav sections={SECTIONS} label="Home sections" />
