<script lang="ts">
	import Breadcrumbs from '$ui/breadcrumbs.svelte'
	import type { Snippet } from 'svelte'

	let {
		title,
		class: className,
		children,
		after,
		crumbs,
	}: {
		title?: string
		class?: string
		children?: Snippet
		after?: Snippet
		crumbs?: App.Breadcrumb[]
	} = $props()

	let offsetHeight = $state(0)

	$effect(() => {
		document.documentElement.style.setProperty('--header-height', `${offsetHeight}px`)
	})
</script>

<header
	class="sticky top-0 z-10 space-y-[.5ch] border-b border-current/10 bg-background/50 p-ch backdrop-blur-xs dark:border-current/25 {className}"
	bind:offsetHeight
>
	<Breadcrumbs {crumbs} />

	<div class="flex flex-wrap justify-between gap-x-lh gap-y-ch">
		<hgroup class="grow">
			{#if children}
				{@render children()}
			{:else}
				<h1 class="h1">{title}</h1>
			{/if}
		</hgroup>

		{#if after}
			{@render after()}
		{/if}
	</div>
</header>
