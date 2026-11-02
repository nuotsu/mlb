<!--
	@component
	A team's logo and name, linked to its page, in its colors. The name shortens to fit the column
	(full name, club, team name, abbreviation).
-->
<script lang="ts">
	import { cn } from '#lib/utils.js'
	import StyledTeam from '#ui/team/styled-team.svelte'
	import type { Snippet } from 'svelte'

	let {
		team,
		lead,
		leadTitle,
		linked = true,
		class: className,
		children,
	}: {
		team: MLB.Team
		/** A small number before the team, like a seed or rank */
		lead?: string | number
		leadTitle?: string
		linked?: boolean
		class?: string
		/** After the name, e.g. the team's league */
		children?: Snippet
	} = $props()
</script>

<div class={cn('flex items-center gap-ch', className)}>
	{#if lead !== undefined}
		<span
			class="w-[3ch] shrink-0 text-right text-xs text-current/50 tabular-nums"
			title={leadTitle}
		>
			{lead}
		</span>
	{/if}

	<StyledTeam class="min-w-0 flex-1 text-left" {team} {linked}>
		{@render children?.()}
	</StyledTeam>
</div>
