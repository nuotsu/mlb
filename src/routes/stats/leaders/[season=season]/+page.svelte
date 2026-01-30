<script lang="ts">
	import { page } from '$app/state'
	import Metadata from '$ui/metadata.svelte'
	import type { PageProps } from './$types'

	let { data }: PageProps = $props()

	$inspect(data)
</script>

<Metadata
	title="{page.params.season} Stat Leaders | MLB.TheOhtani.com"
	description="MLB statistical leaders for the {page.params.season} season"
/>

<section class="p-ch">
	<!-- TODO: build UI -->
</section>
