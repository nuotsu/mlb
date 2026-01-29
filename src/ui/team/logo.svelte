<script lang="ts">
	import { colorSchemeStore } from '$ui/store.svelte'

	let {
		team,
		srcset = `https://www.mlbstatic.com/team-logos/team-cap-on-dark/${team.id}.svg`,
		class: className,
	}: {
		team: MLB.Team
		srcset?: string
		class?: string
	} = $props()

	const src = $derived(`https://midfield.mlbstatic.com/v1/team/${team.id}/spots`)
</script>

<picture class="shrink-0">
	<source {srcset} media={colorSchemeStore.colorScheme === 'dark' ? undefined : '()'} />

	<img
		class="text-transparent {className}"
		src="https://www.mlbstatic.com/team-logos/team-cap-on-light/{team.id}.svg"
		alt={team.name}
		width="300"
		height="300"
		draggable="false"
		onerror={(e) => {
			;(e.currentTarget as HTMLImageElement).src = `${src}/72`
		}}
	/>
</picture>
