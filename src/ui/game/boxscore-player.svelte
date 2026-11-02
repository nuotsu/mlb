<!--
	@component
	A box score line's player: headshot, name and position, linked to their page. Shared by the box
	score and the scorecard, so both views line up the same way.
-->
<script lang="ts">
	import { ArrowDownRightIcon } from '#ui/icons/index.js'
	import Headshot from '#ui/player/headshot.svelte'

	let {
		player,
		players,
		label,
		substitute,
	}: {
		player: MLB.BoxscorePlayer
		/** `gameData.players`, for a pitcher's throwing hand */
		players?: Record<string, MLB.Person> | null
		/** In place of the position, e.g. every position played */
		label?: string
		/** Came in for the batter above, so indented under them */
		substitute?: boolean
	} = $props()

	const { person, position } = $derived(player)
	const throwSide = $derived(players?.[`ID${person.id}`]?.pitchHand?.code)
	const sideLabel = $derived(
		position?.abbreviation === 'P' ? (throwSide ?? position.abbreviation) : position?.abbreviation,
	)
</script>

<a
	href="/player/{person.id}"
	class="group/player relative flex items-center gap-ch text-left"
	class:pl-lh={substitute}
>
	{#if substitute}
		<ArrowDownRightIcon class="absolute left-0 size-ch text-current/40" aria-hidden="true" />
	{/if}

	<Headshot {person} size={72} class="size-lh shrink-0" loading="lazy" decoding="async" alt="" />

	<span class="line-clamp-1 grow break-all decoration-dashed group-hover/player:underline">
		{person.boxscoreName}
	</span>

	<small class="min-w-[3ch] shrink-0 text-center text-xs whitespace-nowrap text-current/40">
		{label ?? sideLabel}
	</small>
</a>
