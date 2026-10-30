<script lang="ts">
	import {
		BallIcon,
		BatIcon,
		CalendarIcon,
		ClipboardIcon,
		HomePlateIcon,
		InjuredListIcon,
	} from '#ui/icons/index.js'
	import SectionNav, { type Section } from '#ui/section-nav.svelte'

	/** The month calendar opens the page, so the top button covers it */
	const SECTIONS: Section[] = [
		{ id: 'top', label: 'Back to top', icon: HomePlateIcon },
		{ id: 'series-calendar', label: 'Series calendar', icon: CalendarIcon },
		{ id: 'batters', label: 'Batters', icon: BatIcon },
		{ id: 'pitchers', label: 'Pitchers', icon: BallIcon },
		{ id: 'coaches', label: 'Coaches', icon: ClipboardIcon },
		{ id: 'injured-list', label: 'Injured list', icon: InjuredListIcon },
	]
</script>

<SectionNav sections={SECTIONS} label="Team sections" />
