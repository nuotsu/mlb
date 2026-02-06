<script lang="ts">
	import type { Snippet } from 'svelte'

	let {
		title,
		class: className,
		children,
		after,
	}: {
		title?: string
		class?: string
		children?: Snippet
		after?: Snippet
	} = $props()

	let offsetHeight = $state(0)

	$effect(() => {
		document.documentElement.style.setProperty('--header-height', `${offsetHeight}px`)
	})
</script>

<header
	class="sticky top-0 z-10 border-b border-current/10 bg-background/50 p-ch backdrop-blur-xs dark:border-current/25 {className}"
	bind:offsetHeight
>
	<nav class="text-sm max-sm:ml-[1.5lh]">
		<ol class="flex min-h-rlh flex-wrap items-center text-xs">
			<li><a href="/">Home</a></li>
		</ol>
	</nav>

	<div class="flex flex-wrap justify-between gap-ch">
		<hgroup class="grow">
			{#if children}
				{@render children()}
			{:else}
				<h1 class="h1">{title}</h1>
			{/if}
		</hgroup>

		{#if after}
			<div class="mx-auto">{@render after()}</div>
		{/if}
	</div>
</header>
