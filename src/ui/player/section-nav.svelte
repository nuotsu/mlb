<script lang="ts">
	import {
		BallIcon,
		GraphLineIcon,
		HomePlateIcon,
		JerseyIcon,
		PortraitIcon,
		StrikezoneIcon,
		TableIcon,
		TrophyCupIcon,
	} from '#ui/icons/index.js'
	import SectionNav, { type Section } from '#ui/section-nav.svelte'

	const SECTIONS: Section[] = [
		{ id: 'top', label: 'Back to top', icon: HomePlateIcon },
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
