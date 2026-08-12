<script lang="ts">
	import { ArrowsDiffIcon } from '$ui/icons'
	import Headshot from '$ui/player/headshot.svelte'
	import Logo from '$ui/team/logo.svelte'

	let {
		transaction,
		class: className,
	}: {
		transaction: MLB.Transaction
		class?: string
	} = $props()

	let { toTeam, fromTeam, person, description } = $derived(transaction)

	let descriptionParts = $derived.by(() => {
		if (!person?.fullName) return null
		const i = description.indexOf(person.fullName)
		if (i === -1) return null
		return {
			before: description.slice(0, i),
			match: description.slice(i, i + person.fullName.length),
			after: description.slice(i + person.fullName.length),
		}
	})
</script>

<li
	class="group/transaction relative flex items-center gap-ch border-t border-current/15 py-[.5ch] {className}"
>
	<span class="flex shrink-0 items-center">
		{#if toTeam}
			<Logo class="size-lh" team={toTeam!} />
		{/if}
		{#if fromTeam}
			<ArrowsDiffIcon class="size-ch shrink-0 text-current/50" />
			<Logo class="size-lh" team={fromTeam!} />
		{/if}
	</span>

	{#if person}
		<figure class="shrink-0">
			<Headshot {person} class="size-lh" size={48} />
		</figure>
	{/if}

	<p class="leading-tight decoration-dashed group-hover/transaction:underline">
		{#if descriptionParts}
			{descriptionParts.before}<strong>{descriptionParts.match}</strong>{descriptionParts.after}
		{:else}
			{description}
		{/if}
	</p>

	{#if person}
		<a class="absolute inset-0 text-transparent" href="/player/{person.id}">
			{person.fullName}
		</a>
	{/if}
</li>
