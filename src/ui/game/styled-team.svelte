<script lang="ts">
	import { cn } from '$lib/utils'
	import { colorSchemeStore } from '$ui/store.svelte'
	import type { Snippet } from 'svelte'

	let {
		team,
		class: className,
		children,
	}: { team: MLB.Team; class?: string; children?: Snippet } = $props()

	let colorScheme = $derived(colorSchemeStore.colorScheme)

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
	<picture class="contents">
		<source srcset="{src}/72" media={colorScheme === 'dark' ? undefined : '()'} />

		<img
			class="size-lh shrink-0 object-contain"
			src="https://www.mlbstatic.com/team-logos/team-cap-on-light/{team.id}.svg"
			width="300"
			height="300"
			alt={team.name}
			draggable="false"
			onerror={(e) => {
				;(e.currentTarget as HTMLImageElement).src = `${src}/72`
			}}
		/>
	</picture>

	<div class="line-clamp-1 grow break-all">
		<span class="@max-sm/team:hidden">{team.name}</span>
		<span class="@max-[12ch]/team:hidden @sm:hidden">{team.teamName}</span>
	</div>

	{@render children?.()}
</div>

<style>
	div:has(picture)::before {
		content: '';
		position: absolute;
		inset: 0;
		z-index: -1;
		background-image: var(--bg);
		background-size: 1500% 1500%;
		background-position: 50% 5%;
	}
</style>
