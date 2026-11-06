<script lang="ts">
	import { teamColor } from '#lib/team-colors.js'
	import { cn } from '#lib/utils.js'

	let {
		teamId,
		class: className,
	}: {
		teamId: number
		/** Sets the size, e.g. `size-6` */
		class?: string
	} = $props()

	// Falls back to the team's spot image when there's no on-dark cap logo
	let fallback = $state(false)
</script>

<span
	class={cn('block shrink-0 rounded-full', className)}
	style:background-color={teamColor(teamId)}
>
	<img
		class={cn('size-full rounded-full', fallback ? 'object-cover' : 'object-contain p-[18%]')}
		src={fallback
			? `https://midfield.mlbstatic.com/v1/team/${teamId}/spots/72`
			: `https://www.mlbstatic.com/team-logos/team-cap-on-dark/${teamId}.svg`}
		alt=""
		width="72"
		height="72"
		draggable="false"
		onerror={() => (fallback = true)}
	/>
</span>
