<script lang="ts">
	import { isDarkOnLightTeam, isLightOnDarkTeam } from '$lib/colors'
	import { cn } from '$lib/utils'
	import type { Snippet } from 'svelte'
	import Logo from './logo.svelte'

	let {
		team,
		class: className,
		linked,
		children,
	}: {
		team: MLB.Team
		class?: string
		linked?: boolean
		children?: Snippet
	} = $props()

	const src = $derived(`https://midfield.mlbstatic.com/v1/team/${team.id}/spots`)
</script>

<div
	class={cn(
		'group/team @container/team relative flex items-center gap-[.5ch]',
		isDarkOnLightTeam(team) && 'dark:text-dark',
		isLightOnDarkTeam(team) && 'dark:text-light',
		className,
	)}
	style:--team-bg="url('{src}/32')"
>
	<Logo srcset="{src}/72" class="size-lh shrink-0 object-contain" {team} />

	<div
		class="line-clamp-1 shrink-0 grow break-all *:decoration-dashed group-has-[a:hover]/team:*:underline"
	>
		<span class="@max-3xs/team:hidden">{team.name}</span>
		<span class="@max-[12ch]/team:hidden @3xs:hidden">{team.teamName}</span>
		{#if team.abbreviation}
			<span class="@max-[7ch]/team:hidden @min-[12ch]/team:hidden">{team.abbreviation}</span>
		{/if}
	</div>

	{@render children?.()}

	{#if linked}
		<a href="/teams/{team.id}" class="absolute inset-0 text-transparent">
			{team.name}
		</a>
	{/if}
</div>
