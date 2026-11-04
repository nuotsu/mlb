<script lang="ts">
	import { teamColor } from '#lib/team-colors.js'
	import { cn } from '#lib/utils.js'
	import { CloseIcon } from '#ui/icons/index.js'
	import Headshot from '#ui/player/headshot.svelte'

	let {
		href,
		label,
		teamId,
		personId,
		title,
		removeLabel,
		onremove,
	}: {
		href: string
		label: string
		/** Shows the team's cap logo on its primary color */
		teamId?: number
		/** Shows the player's headshot */
		personId?: number
		title?: string
		removeLabel: string
		onremove: () => void
	} = $props()

	// Falls back to the team's spot image when there's no on-dark cap logo
	let fallback = $state(false)
</script>

<li
	class="flex anim-fade-to-r items-center rounded-full border border-current/25 transition-colors has-[a:hover]:border-accent"
>
	<a class="flex items-center gap-[.5ch] py-[.25ch] pl-[.25ch] text-sm" {href} {title}>
		{#if teamId}
			<span class="block size-6 shrink-0 rounded-full" style:background-color={teamColor(teamId)}>
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
		{:else if personId}
			<Headshot class="size-6 shrink-0" person={{ id: personId }} size={72} />
		{/if}
		<span class="max-w-[20ch] truncate">{label}</span>
	</a>

	<button
		class="tap mx-[.25ch] grid size-6 shrink-0 place-items-center rounded-full text-current/60 transition-colors hover:bg-current/10 hover:text-current"
		onclick={onremove}
		aria-label={removeLabel}
		title={removeLabel}
	>
		<CloseIcon />
	</button>
</li>

<style>
	/* At least 44px of tap target around the small button */
	.tap {
		position: relative;

		&::before {
			content: '';
			position: absolute;
			inset: min(0px, calc((100% - 44px) / 2));
		}
	}
</style>
