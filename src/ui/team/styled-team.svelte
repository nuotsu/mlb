<script lang="ts">
	import { isDarkOnLightTeam, isLightOnDarkTeam } from '$lib/colors'
	import { cn } from '$lib/utils'
	import type { Snippet } from 'svelte'
	import Logo from './logo.svelte'

	let {
		team,
		class: className,
		linked,
		record,
		children,
	}: {
		team: MLB.Team
		class?: string
		linked?: boolean
		record?: MLB.LeagueRecord
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
		class="line-clamp-1 break-all *:decoration-dashed group-has-[a:hover]/team:*:underline"
		data-name
	>
		<span class="@max-[24ch]/team:hidden">{team.name}</span>
		<span class="@max-[18ch]/team:hidden @min-[24ch]:hidden">{team.clubName}</span>
		<span class="@max-[14ch]/team:hidden @min-[18ch]:hidden">{team.teamName}</span>
		{#if team.abbreviation}
			<span class="@max-[8ch]/team:hidden @min-[14ch]/team:hidden">{team.abbreviation}</span>
		{/if}
	</div>

	{#if record}
		<small class="text-xs whitespace-nowrap text-current/50 @max-[12ch]/team:hidden">
			{record.wins}-{record.losses}
		</small>
	{/if}

	{@render children?.()}

	{#if linked}
		<a href="/teams/{team.id}" class="absolute inset-0 text-transparent">
			{team.name}
		</a>
	{/if}
</div>
