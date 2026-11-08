<!--
	@component
	A KBO game's umpires, as a section like the MLB game page's, with the same crew rows. The box
	score lists them in the crew's order: home plate, first, second and third base, then the
	outfield in the postseason. koreabaseball.com has no pitch locations, so no zone plot either.
-->
<script lang="ts">
	import type { KboGame } from '#lib/kbo-game.js'
	import { cn } from '#lib/utils.js'
	import CrewMember from '#ui/game/umpires/crew-member.svelte'

	let { game, class: className }: { game: KboGame; class?: string } = $props()

	const POSITIONS = [
		'Home Plate',
		'First Base',
		'Second Base',
		'Third Base',
		'Left Field',
		'Right Field',
	]

	const crew = $derived(
		game.umpires.map(
			(nameKo, i) =>
				({
					officialType: POSITIONS[i] ?? 'Umpire',
					official: { id: i, fullName: nameKo },
				}) as MLB.Official,
		),
	)
</script>

{#if crew.length}
	<section id="umpires" class={cn('space-y-ch px-ch', className)}>
		<h2 class="text-center text-xs text-current/40">Umpires</h2>

		<ul class="mx-auto grid max-w-max text-sm" lang="ko">
			{#each crew as official (official.official.id)}
				<li><CrewMember {official} /></li>
			{/each}
		</ul>
	</section>
{/if}
