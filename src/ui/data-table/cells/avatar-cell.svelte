<!--
	@component
	Just a player's headshot, for the narrow column that stays put while the names beside it scroll
	away. Linked like the name, but left out of the tab order and screen readers, where the name's
	link already is.
-->
<script lang="ts">
	import Headshot from '#ui/player/headshot.svelte'

	let {
		person,
		type = 'spots',
		size = 72,
	}: {
		person: Partial<MLB.Person>
		/** `silo` sits on the team's colors; `spots` is the round headshot */
		type?: 'spots' | 'silo'
		size?: number
	} = $props()
</script>

{#if person.id}
	<a class="block" href="/player/{person.id}" tabindex="-1" aria-hidden="true">
		<Headshot {person} {type} {size} class="size-lh" loading="lazy" decoding="async" alt="" />
	</a>
{:else}
	<Headshot {person} {type} {size} class="size-lh" loading="lazy" decoding="async" alt="" />
{/if}
