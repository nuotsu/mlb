<script lang="ts">
	import { CalendarIcon, CrutchesIcon, HomePlateIcon, JerseyIcon } from '#ui/icons/index.js'
	import SectionNav, { type Section } from '#ui/section-nav.svelte'

	/** The month calendar opens the page, so the top button covers it */
	const SECTIONS: Section[] = [
		{ id: 'top', label: 'Back to top', icon: HomePlateIcon },
		{ id: 'series-calendar', label: 'Series calendar', icon: CalendarIcon },
		{ id: 'roster', label: 'Roster', icon: JerseyIcon },
		{ id: 'injured-list', label: 'Injured list', icon: CrutchesIcon },
	]
</script>

<SectionNav sections={SECTIONS} label="Team sections" />
