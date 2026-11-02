<!--
	@component
	A player's headshot and name, linked to their page. The headshot has a fixed size so nothing
	shifts as it loads, and only loads once its row is near the screen.
-->
<script lang="ts">
	import { cn } from '#lib/utils.js'
	import Headshot from '#ui/player/headshot.svelte'
	import type { Snippet } from 'svelte'

	let {
		person,
		name = person.lastName ?? person.boxscoreName ?? person.fullName,
		type = 'spots',
		size = 72,
		href = person.id ? `/player/${person.id}` : undefined,
		title = person.fullName,
		class: className,
		nameClass,
		headshot = true,
		children,
	}: {
		person: Partial<MLB.Person>
		name?: string
		/** `silo` sits on the team's colors; `spots` is the round headshot */
		type?: 'spots' | 'silo'
		size?: number
		href?: string
		title?: string
		class?: string
		nameClass?: string
		/** Off when the headshot has a (sticky) column of its own */
		headshot?: boolean
		/** After the name, e.g. a position */
		children?: Snippet
	} = $props()
</script>

<svelte:element
	this={href ? 'a' : 'div'}
	{href}
	{title}
	class={cn(
		'group/player flex min-w-0 items-center gap-ch text-left',
		href && 'decoration-dashed',
		className,
	)}
>
	{#if headshot}
		<Headshot
			{person}
			{type}
			{size}
			class="size-lh shrink-0"
			loading="lazy"
			decoding="async"
			alt=""
		/>
	{/if}

	<span class={cn('line-clamp-1 grow break-all group-hover/player:underline', nameClass)}>
		{name}
	</span>

	{@render children?.()}
</svelte:element>
