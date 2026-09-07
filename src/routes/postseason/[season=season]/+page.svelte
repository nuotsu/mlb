<script lang="ts">
	import { goto } from '$app/navigation'
	import { page } from '$app/state'
	import Empty from '$ui/empty.svelte'
	import Header from '$ui/header.svelte'
	import Metadata from '$ui/metadata.svelte'
	import Bracket from '$ui/postseason/bracket.svelte'
	import SelectSeason from '$ui/stats/select-season.svelte'
	import type { PageProps } from './$types'

	let { data }: PageProps = $props()
</script>

<Metadata
	title="{page.params.season} MLB Postseason Bracket | MLB.TheOhtani.com"
	description="MLB playoff bracket for the {page.params.season} postseason{data.bracket?.projected
		? ', projected from the current standings'
		: ''}"
/>

<Header title="Postseason" crumbs={[{ name: 'Postseason' }]}>
	{#snippet after()}
		<SelectSeason
			onchange={(e) => goto(`/postseason/${(e.currentTarget as HTMLSelectElement).value}`)}
		/>
	{/snippet}
</Header>

<section class="grid gap-lh p-ch">
	{#if data.bracket}
		<Bracket bracket={data.bracket} />
	{:else}
		<Empty>No postseason bracket for {page.params.season}</Empty>
	{/if}
</section>
