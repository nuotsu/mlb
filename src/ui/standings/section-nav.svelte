<script lang="ts">
	import { BarsHorizontalIcon, HomePlateIcon, ScatterIcon } from '#ui/icons/index.js'
	import SectionNav, { type Section } from '#ui/section-nav.svelte'

	/** The standings open the page, so their button scrolls back to the top */
	const SECTIONS: Section[] = [
		{ id: 'standings', label: 'Standings', icon: HomePlateIcon },
		{ id: 'payroll', label: 'Payroll vs. win %', icon: ScatterIcon },
		{ id: 'payroll-by-team', label: 'Payroll by team', icon: BarsHorizontalIcon },
	]
</script>

<SectionNav sections={SECTIONS} label="Standings sections" />
