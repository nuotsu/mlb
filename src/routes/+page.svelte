<script lang="ts">
	import { homeLayoutScript } from '#lib/home.js'
	import { SITE_DESCRIPTION } from '#lib/seo.js'
	import Awards from '#ui/banner/awards.svelte'
	import Grid from '#ui/home/grid.svelte'
	import Hero from '#ui/home/hero.svelte'
	import SectionNav from '#ui/home/section-nav.svelte'
	import Metadata from '#ui/metadata.svelte'
	import type { PageProps } from './$types'

	let { data }: PageProps = $props()

	const widgetData = $derived({
		season: data.season,
		phase: data.phase,
		standingsSeason: data.standingsSeason,
		transactions: data.transactions?.transactions ?? [],
		posts: data.posts,
	})
</script>

<Metadata
	title="Live MLB Scores, Standings & Stats | MLB.TheOhtani.com"
	description={SITE_DESCRIPTION}
/>

<svelte:head>
	<!-- Your saved widget layout, from the first paint of the cached (default) page -->
	{@html `<script>${homeLayoutScript()}<\/script>`}
</svelte:head>

<div
	class="flex min-h-[calc(100dvh-1ch)] flex-col gap-lh pb-[max(2lh,env(safe-area-inset-bottom))]"
>
	<Hero />

	<section id="home-widgets" class="scroll-mt-ch px-ch" aria-label="Your widgets">
		<Grid data={widgetData} />
	</section>

	<Awards />
</div>

<SectionNav />
