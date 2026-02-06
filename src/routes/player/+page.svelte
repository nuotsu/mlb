<script lang="ts">
	import Header from '$ui/header.svelte'
	import Metadata from '$ui/metadata.svelte'
	import Search from '$ui/player/search.svelte'
</script>

<Metadata title="Player Directory | MLB.TheOhtani.com" description="Search for a player by name" />

<Header title="Player Directory" crumbs={[{ href: '/player', name: 'Players' }]} />

<section class="p-ch">
	<Search />
</section>
