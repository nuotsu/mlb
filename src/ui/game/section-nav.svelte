<script lang="ts">
	import {
		BallIcon,
		BatteryIcon,
		GraphLineIcon,
		HomePlateIcon,
		InfoIcon,
		ListUnorderedIcon,
		PencilLineIcon,
		ReplayCameraIcon,
		StrikezoneIcon,
		TrajectoryIcon,
		TrophyCupIcon,
		VideoPlayIcon,
	} from '#ui/icons/index.js'
	import SectionNav, { type Section } from '#ui/section-nav.svelte'

	/** The scoreboard lives in the sticky header, so its button scrolls back to the top */
	const SECTIONS: Section[] = [
		{ id: 'scoreboard', label: 'Scoreboard', icon: HomePlateIcon },
		{ id: 'pitch-sequence', label: 'Pitch sequence', icon: BallIcon },
		{ id: 'plays', label: 'Plays', icon: ListUnorderedIcon },
		{ id: 'win-probability', label: 'Win probability', icon: GraphLineIcon },
		{ id: 'highlights', label: 'Highlights', icon: VideoPlayIcon },
		{ id: 'game-info', label: 'Game info', icon: InfoIcon },
		{ id: 'boxscore', label: 'Box score', icon: PencilLineIcon },
		{ id: 'bullpen-fatigue', label: 'Bullpen fatigue', icon: BatteryIcon },
		{ id: 'top-performers', label: 'Top performers', icon: TrophyCupIcon },
		{ id: 'reviews', label: 'Reviews', icon: ReplayCameraIcon },
		{ id: 'home-runs', label: 'Home runs', icon: TrajectoryIcon },
		{ id: 'umpires', label: 'Umpires', icon: StrikezoneIcon },
	]
</script>

<SectionNav sections={SECTIONS} label="Game sections" />
