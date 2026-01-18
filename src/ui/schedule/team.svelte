<script lang="ts">
	import { cn } from '$lib/utils'
	import { colorSchemeStore } from '$ui/store.svelte'

	let { team }: { team: MLB.Team } = $props()
	let colorScheme = $derived(colorSchemeStore.colorScheme)

	const darkOnLightTeams = [
		'Asheville Tourists',
		'Miami Marlins',
		'Minnesota Golden Gophers',
		'San Diego Padres',
		'San Francisco Giants',
		'Sugar Land Space Cowboys',
		'Sultanes de Monterrey',
		'Tampa Bay Rays',
		'Northeastern Huskies',
	]

	const src = $derived(`https://midfield.mlbstatic.com/v1/team/${team.id}/spots`)

	const isDarkOnLightTeam = $derived(
		darkOnLightTeams.includes(team.name) || [51].includes((team as MLB.TeamDetailed).sport?.id!),
	)
</script>

<figure
	class={cn(
		'relative inline-flex items-center gap-[.5ch] px-[.5ch] not-dark:before:opacity-10',
		isDarkOnLightTeam && 'dark:text-dark',
	)}
	style:--bg="url('{src}/32')"
>
	<picture class="contents">
		<source srcset="{src}/72" media={colorScheme === 'dark' ? undefined : '()'} />

		<img
			class="size-lh shrink-0"
			src="https://www.mlbstatic.com/team-logos/team-cap-on-light/{team.id}.svg"
			width="72"
			height="72"
			alt={team.name}
			draggable="false"
			onerror={(e) => {
				;(e.currentTarget as HTMLImageElement).src = `${src}/72`
			}}
		/>
	</picture>

	<figcaption class="line-clamp-1 break-all">{team.teamName}</figcaption>
</figure>

<style>
	figure::before {
		content: '';
		position: absolute;
		inset: 0;
		z-index: -1;
		background-image: var(--bg);
		background-size: 1500% 1500%;
		background-position: 50% 5%;
	}
</style>
