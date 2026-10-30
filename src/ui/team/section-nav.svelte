<script lang="ts">
	import {
		BatterIcon,
		BreakingBallIcon,
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
		{ id: 'batters', label: 'Batters', icon: BatterIcon },
		{ id: 'pitchers', label: 'Pitchers', icon: BreakingBallIcon },
		{ id: 'coaches', label: 'Coaches', icon: ClipboardIcon },
		{ id: 'injured-list', label: 'Injured list', icon: InjuredListIcon },
	]
</script>

<SectionNav sections={SECTIONS} label="Team sections" />
