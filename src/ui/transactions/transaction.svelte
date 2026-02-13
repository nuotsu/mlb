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
			<Headshot {person} class="size-lh" />
		</figure>
	{/if}

	<p class="leading-tight decoration-dashed group-hover/transaction:underline">
		{description}
	</p>

	{#if person}
		<a
			class="absolute inset-0 text-transparent"
			href="/player/{person.id}"
			aria-label={person.fullName}
		>
			{person.fullName}
		</a>
	{/if}
</li>
