<script lang="ts">
	import Rollup from '#ui/blog/rollup.svelte'
	import Header from '#ui/header.svelte'
	import Metadata from '#ui/metadata.svelte'
	import type { PageData } from './$types'

	const { data }: { data: PageData } = $props()
</script>

<Metadata
	title="Blog | MLB.TheOhtani.com"
	description="Mitchell's Live ScoreBug Blog: MLB analysis and game coverage, player and stats deep dives, fantasy advice and more from the developer building a better baseball app."
/>

<Header title="Blog" crumbs={[{ href: '/blog', name: 'Blog' }]} />

<section class="p-ch">
	<Rollup posts={data.posts} class="mx-auto max-w-3xl" />
</section>
