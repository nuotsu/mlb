<script lang="ts">
	import { SITE_NAME, SITE_URL } from '#lib/seo.js'
	import { formatDate } from '#lib/temporal.js'
	import Baseball from '#ui/baseball.svelte'
	import Breadcrumbs from '#ui/breadcrumbs.svelte'
	import Metadata from '#ui/metadata.svelte'
	import TableOfContents from '#ui/table-of-contents.svelte'
	import { page } from '$app/state'
	import type { PageData } from './$types'

	const { data }: { data: PageData } = $props()

	const Component = $derived(data.post.default)
	const { title, description, image, tags } = $derived(data.post.metadata)

	/** The front matter's YYYY-MM-DD date, read as a local calendar day */
	const date = $derived(String(data.post.metadata.date ?? '').split('T')[0])

	const jsonLd = $derived(
		JSON.stringify({
			'@context': 'https://schema.org',
			'@type': 'BlogPosting',
			headline: title,
			description,
			url: SITE_URL + page.url.pathname,
			mainEntityOfPage: SITE_URL + page.url.pathname,
			...(image && { image }),
			...(date && { datePublished: date }),
			...(tags?.length && { keywords: tags.join(', ') }),
			author: { '@type': 'Person', name: 'nuotsu', url: 'https://github.com/nuotsu' },
			publisher: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
		}).replaceAll('<', '\\u003c'),
	)
</script>

<Metadata {title} {description} {image} type="article" publishedTime={date} />

<svelte:head>
	{@html `<script type="application/ld+json">${jsonLd}<\/script>`}
</svelte:head>

<header class="p-ch">
	<Breadcrumbs crumbs={[{ href: '/blog', name: 'Blog' }, { name: title }]} />
</header>

<article class="grid gap-y-lh">
	<hgroup class="col-span-full space-y-ch px-ch text-center">
		<h1 class="h0! text-balance">{title}</h1>

		{#if date}
			<p class="text-sm text-current/50">
				<time datetime={date}>
					{formatDate(date, { locale: 'en-US', month: 'long', day: 'numeric', year: 'numeric' })}
				</time>
			</p>
		{/if}
	</hgroup>

	<div class="col-[content] px-ch md:col-[3/4] md:row-[2/3]">
		<TableOfContents
			class="sticky top-lh border-dashed border-stroke text-sm leading-tight *:space-y-ch max-md:border max-md:p-ch"
		/>
	</div>

	<div class="col-[content] prose px-ch md:row-[2/3]">
		<Component />

		<Baseball class="mx-auto mt-[-2lh] mb-[2lh] w-[160px] text-[8px]" />
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
