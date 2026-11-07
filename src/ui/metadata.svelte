<script lang="ts">
	import { OG_IMAGE, SITE_NAME, SITE_URL } from '#lib/seo.js'
	import { page } from '$app/state'

	let {
		title,
		description,
		image,
		type = 'website',
		publishedTime,
		noindex = false,
	}: {
		title: string
		description: string
		/** Absolute URL; defaults to the site-wide 1200x630 preview */
		image?: string
		type?: 'website' | 'article'
		/** YYYY-MM-DD, for `type="article"` */
		publishedTime?: string
		noindex?: boolean
	} = $props()

	/** Production origin, no query string: filters and `?date=` views share one canonical page */
	const url = $derived(SITE_URL + page.url.pathname)
</script>

<svelte:head>
	<title>{title}</title>
	<meta name="description" content={description} />

	{#if noindex}
		<meta name="robots" content="noindex" />
	{:else}
		<link rel="canonical" href={url} />
	{/if}

	<meta property="og:type" content={type} />
	<meta property="og:site_name" content={SITE_NAME} />
	<meta property="og:locale" content="en_US" />
	<meta property="og:url" content={url} />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={description} />
	{#if image}
		<meta property="og:image" content={image} />
	{:else}
		<meta property="og:image" content={OG_IMAGE.url} />
		<meta property="og:image:width" content={String(OG_IMAGE.width)} />
		<meta property="og:image:height" content={String(OG_IMAGE.height)} />
	{/if}
	{#if type === 'article' && publishedTime}
		<meta property="article:published_time" content={publishedTime} />
	{/if}

	<meta name="twitter:card" content={image ? 'summary' : 'summary_large_image'} />
	<meta name="twitter:title" content={title} />
	<meta name="twitter:description" content={description} />
	<meta name="twitter:image" content={image ?? OG_IMAGE.url} />
</svelte:head>
