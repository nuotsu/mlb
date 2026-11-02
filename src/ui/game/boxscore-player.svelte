<!--
	@component
	A box score line's player, linked to their page: the headshot, or the name and position, each
	in a column of its own so only the headshot stays put while the table scrolls sideways. Shared
	by the box score and the scorecard, so both views line up the same way.
-->
<script lang="ts">
	import { ArrowDownRightIcon } from '#ui/icons/index.js'
	import Headshot from '#ui/player/headshot.svelte'

	let {
		player,
		players,
		label,
		substitute,
		part,
	}: {
		player: MLB.BoxscorePlayer
		/** `gameData.players`, for a pitcher's throwing hand */
		players?: Record<string, MLB.Person> | null
		/** In place of the position, e.g. every position played */
		label?: string
		/** Came in for the batter above, so indented under them */
		substitute?: boolean
		/** The headshot (its own sticky column) or the name and position (which scroll) */
		part: 'avatar' | 'name'
	} = $props()

	const { person, position } = $derived(player)
	const throwSide = $derived(players?.[`ID${person.id}`]?.pitchHand?.code)
	const sideLabel = $derived(
		position?.abbreviation === 'P' ? (throwSide ?? position.abbreviation) : position?.abbreviation,
	)
</script>

{#if part === 'avatar'}
	<!-- The name's link is the one in the tab order; this one is just a bigger target -->
	<a class="relative block" href="/player/{person.id}" tabindex="-1" aria-hidden="true">
		{#if substitute}
			<!-- In the headshot's place, with the headshot nudged aside, so the column doesn't widen -->
			<ArrowDownRightIcon class="absolute inset-y-0 left-0 my-auto size-ch text-current/40" />
		{/if}

		<Headshot
			{person}
			size={72}
			class={['size-lh', substitute && 'translate-x-lh']}
			loading="lazy"
			decoding="async"
			alt=""
		/>
	</a>
{:else}
	<a
		href="/player/{person.id}"
		class="group/player flex items-center gap-[.5ch] text-left"
		class:pl-lh={substitute}
	>
		<span class="line-clamp-1 grow break-all decoration-dashed group-hover/player:underline">
			{person.boxscoreName}
		</span>

		<small class="min-w-[3ch] shrink-0 text-center text-xs whitespace-nowrap text-current/40">
			{label ?? sideLabel}
		</small>
	</a>
{/if}
