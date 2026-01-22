<script lang="ts">
	import Metadata from '$ui/metadata.svelte'
	import type { PageProps } from './$types'

	let { data }: PageProps = $props()
	let player = $derived(data.person)

	$inspect(player)
</script>

<Metadata title="{player.fullName} | MLB.TheOhtani.com" description="{player.fullName} profile" />

<section class="p-ch">
	<h1>{player.fullName} #{player.primaryNumber}</h1>
</section>
