<script lang="ts">
	import { page } from '$app/state'

	let {
		crumbs = [],
	}: {
		crumbs?: App.Breadcrumb[]
	} = $props()

	const list: App.Breadcrumb[] = $derived(
		[{ href: '/', name: 'Home' }, ...crumbs].filter((c) => c.name),
	)
</script>

{#snippet crumb({ href, name }: App.Breadcrumb, position: number)}
	<li itemprop="itemListElement" itemscope itemtype="https://schema.org/ListItem">
		<a href={href ?? page.url.pathname} class="not-hover:text-current/50" itemprop="item">
			<span itemprop="name">{name}</span>
		</a>

		<meta itemprop="position" content={position.toString()} />
	</li>
{/snippet}

<nav class=" text-sm leading-none font-light max-sm:ml-[1.25rlh]" aria-label="Breadcrumb">
	<ol
		class="no-scrollbar flex min-h-rlh items-center gap-ch overflow-x-auto text-xs"
		itemscope
		itemtype="https://schema.org/BreadcrumbList"
	>
		{#each list as item, i}
			{@render crumb(item, i + 1)}
		{/each}
	</ol>
</nav>

<style>
	li {
		flex-shrink: 0;
		display: flex;
		gap: 1ch;

		&:not(:first-child)::before {
			content: '/';
			color: color-mix(in srgb, currentColor 25%, transparent);
		}
	}
</style>
