<script lang="ts">
	import Baseball from '#ui/baseball.svelte'
	import Breadcrumbs from '#ui/breadcrumbs.svelte'
	import Metadata from '#ui/metadata.svelte'
	import TableOfContents from '#ui/table-of-contents.svelte'
	import type { PageData } from './$types'

	const { data }: { data: PageData } = $props()

	const Component = $derived(data.post.default)
	const { title, description } = $derived(data.post.metadata)
</script>

<Metadata {title} {description} />

<header class="p-ch">
	<Breadcrumbs crumbs={[{ href: '/blog', name: 'Blog' }, { name: title }]} />
</header>

<article class="grid gap-y-lh">
	<h1 class="col-span-full px-ch text-center h0! text-balance">{title}</h1>

	<div class="col-[content] px-ch md:col-[3/4] md:row-[2/3]">
		<TableOfContents
			class="sticky top-lh border-dashed border-stroke text-sm leading-tight *:space-y-ch max-md:border max-md:p-ch"
		/>
	</div>

	<div class="col-[content] prose px-ch md:row-[2/3]">
		<Component />

		<Baseball class="mx-auto my-[-2lh] w-[160px] text-[8px]" />
	</div>
</article>

<style>
	article {
		padding-block: 1lh max(1lh, env(safe-area-inset-bottom));
		grid-template-columns:
			[bleed-start] 1fr [content-start] minmax(0, var(--container-2xl))
			[content-end] 1fr [bleed-end];
	}

	.prose :global(:is(ul, ol)) {
		list-style: revert;
		padding-left: 1em;
	}
</style>
