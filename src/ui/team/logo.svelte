<script lang="ts">
	import { colorSchemeStore } from '$ui/store.svelte'
	import type { HTMLAttributes } from 'svelte/elements'

	let {
		team,
		srcset = `https://www.mlbstatic.com/team-logos/team-cap-on-dark/${team.id}.svg`,
		class: className,
		...props
	}: {
		team: MLB.Team
		srcset?: string
		class?: string
	} & HTMLAttributes<HTMLImageElement> = $props()

	const src = $derived(`https://midfield.mlbstatic.com/v1/team/${team.id}/spots`)

	let { id, name } = $derived(team)

	let fallback = $state(false)
	let srcsetValid = $state(false)

	$effect(() => {
		if (!srcset) return

		const img = new Image()
		img.src = srcset
		img.onload = () => (srcsetValid = true)
	})
</script>

<picture class="shrink-0">
	{#if srcsetValid}
		<source {srcset} media={colorSchemeStore.colorScheme === 'dark' ? undefined : '()'} />
	{/if}

	<img
		class="overflow-hidden text-transparent {className}"
		src={fallback
			? `${src}/72`
			: `https://www.mlbstatic.com/team-logos/team-cap-on-light/${id}.svg`}
		alt={name}
		width="300"
		height="300"
		draggable="false"
		onerror={() => {
			if (!fallback) fallback = true
		}}
		{...props}
	/>
</picture>
