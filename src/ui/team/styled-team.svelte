<script lang="ts">
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

	const isDarkOnLightTeam = $derived(
		[
			'Asheville Tourists',
			'Miami Marlins',
			'Minnesota Golden Gophers',
			'San Diego Padres',
			'San Francisco Giants',
			'Sugar Land Space Cowboys',
			'Sultanes de Monterrey',
			'Tampa Bay Rays',
			'Northeastern Huskies',
		].includes(team.name) || [51].includes((team as MLB.TeamDetailed).sport?.id!),
	)

	const isLightOnDarkTeam = $derived(['Hanshin Tigers', 'Tokyo Yomiuri Giants'].includes(team.name))
</script>

<div
	class={cn(
		'@container/team relative flex items-center gap-[.5ch] not-dark:before:opacity-10',
		isDarkOnLightTeam && 'dark:text-dark',
		isLightOnDarkTeam && 'dark:text-light',
		className,
	)}
	style:--bg="url('{src}/32')"
>
	<Logo srcset="{src}/72" class="size-lh shrink-0 object-contain" {team} />

	<div class="line-clamp-1 grow break-all">
		<span class="@max-sm/team:hidden">{team.name}</span>
		<span class="@max-[12ch]/team:hidden @sm:hidden">{team.teamName}</span>
		{#if team.abbreviation}
			<span class="@max-[7ch]/team:hidden @min-[12ch]/team:hidden">{team.abbreviation}</span>
		{/if}
	</div>

	{@render children?.()}
</div>

<style>
	.\@container\/team:global(:has(picture)::before) {
		content: '';
		position: absolute;
		inset: 0;
		z-index: -1;
		background-image: var(--bg);
		background-size: 1500% 1500%;
		background-position: 50% 5%;
	}
</style>
