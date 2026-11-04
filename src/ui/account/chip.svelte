<script lang="ts">
	import { cn } from '#lib/utils.js'
	import { CloseIcon } from '#ui/icons/index.js'
	import Headshot from '#ui/player/headshot.svelte'
	import Logo from '#ui/team/logo.svelte'

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
		/** Shows the team's logo and a wash of its colors */
		teamId?: number
		/** Shows the player's headshot */
		personId?: number
		title?: string
		removeLabel: string
		onremove: () => void
	} = $props()
</script>

<li
	class={cn(
		'relative isolate flex anim-fade-to-r items-center overflow-hidden rounded-full border border-current/25 transition-colors has-[a:hover]:border-accent',
		teamId && 'before:opacity-25 dark:before:opacity-40',
	)}
	style:--team-bg={teamId
		? `url(https://midfield.mlbstatic.com/v1/team/${teamId}/spots/32)`
		: undefined}
>
	<a class="flex items-center gap-[.5ch] py-[.25ch] pl-[.25ch] text-sm" {href} {title}>
		{#if teamId}
			<Logo class="size-6" team={{ id: teamId, name: label } as MLB.Team} />
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
