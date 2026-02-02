<script lang="ts">
	import { isDarkOnLightTeam, isLightOnDarkTeam } from '$lib/colors'
	import { cn } from '$lib/utils'
	import type { Snippet } from 'svelte'
	import Logo from './logo.svelte'

	let {
		team,
		class: className,
		children,
	}: {
		team: MLB.Team
		class?: string
		children?: Snippet
	} = $props()

	const src = $derived(`https://midfield.mlbstatic.com/v1/team/${team.id}/spots`)
</script>

<div
	class={cn(
		'@container/team relative flex items-center gap-[.5ch]',
		isDarkOnLightTeam(team) && 'dark:text-dark',
		isLightOnDarkTeam(team) && 'dark:text-light',
		className,
	)}
	style:--team-bg="url('{src}/32')"
>
	<Logo srcset="{src}/72" class="size-lh shrink-0 object-contain" {team} />

	<div class="line-clamp-1 shrink-0 grow break-all">
		<span class="@max-sm/team:hidden">{team.name}</span>
		<span class="@max-[12ch]/team:hidden @sm:hidden">{team.teamName}</span>
		{#if team.abbreviation}
			<span class="@max-[7ch]/team:hidden @min-[12ch]/team:hidden">{team.abbreviation}</span>
		{/if}
	</div>

	{@render children?.()}
</div>
