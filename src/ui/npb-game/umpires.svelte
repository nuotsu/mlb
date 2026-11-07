<!--
	@component
	An NPB game's umpires, as a section like the MLB game page's, with the same crew rows.
	npb.jp has no pitch locations, so there's no zone plot or accuracy.
-->
<script lang="ts">
	import { umpireTitle, type NpbGame, type NpbLang } from '#lib/npb-game.js'
	import { cn } from '#lib/utils.js'
	import CrewMember from '#ui/game/umpires/crew-member.svelte'

	let { game, lang, class: className }: { game: NpbGame; lang: NpbLang; class?: string } = $props()

	const crew = $derived(
		game.umpires.map(
			(umpire, i) =>
				({
					officialType: umpireTitle(umpire.position),
					official: { id: i, fullName: umpire.nameJa },
				}) as MLB.Official,
		),
	)
</script>

{#if crew.length}
	<section id="umpires" class={cn('space-y-ch px-ch', className)}>
		<h2 class="text-center text-xs text-current/40">{lang === 'ja' ? '審判' : 'Umpires'}</h2>

		<ul class="mx-auto grid max-w-max text-sm" lang="ja">
			{#each crew as official (official.officialType)}
				<li><CrewMember {official} /></li>
			{/each}
		</ul>
	</section>
{/if}
