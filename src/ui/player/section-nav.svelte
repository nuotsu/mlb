<script lang="ts">
	import {
		BallIcon,
		GraphLineIcon,
		IdCardIcon,
		JerseyIcon,
		PortraitIcon,
		StrikezoneIcon,
		TableIcon,
		TrophyCupIcon,
	} from '#ui/icons/index.js'
	import SectionNav, { type Section } from '#ui/section-nav.svelte'

	/** The profile opens the page under the sticky header, so its button scrolls back to the top */
	const SECTIONS: Section[] = [
		{ id: 'profile', label: 'Profile', icon: IdCardIcon },
		{ id: 'teams', label: 'Teams', icon: JerseyIcon },
		{ id: 'headshots', label: 'Headshots', icon: PortraitIcon },
		{ id: 'stats', label: 'Season stats', icon: TableIcon },
		{ id: 'pitch-arsenal', label: 'Pitch arsenal', icon: BallIcon },
		{ id: 'year-by-year', label: 'Year-by-year', icon: GraphLineIcon },
		{ id: 'hot-cold-zones', label: 'Hot/cold zones', icon: StrikezoneIcon },
		{ id: 'awards', label: 'Awards', icon: TrophyCupIcon },
	]
</script>

<SectionNav sections={SECTIONS} label="Player sections" />
