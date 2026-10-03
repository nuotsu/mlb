<script lang="ts">
	import { fetchMLB } from '#lib/fetch/index.js'
	import Loading from '#ui/loading.svelte'
	import Video from '#ui/video.svelte'

	let { gamePk, id }: { gamePk: string; id: string } = $props()

	async function fetchHighlight() {
		const data = await fetchMLB<MLB.GameContent>(`/api/v1/game/${gamePk}/content`)
		const highlight = data.highlights.highlights?.items.find((h) => h.id === id)
		return {
			title: highlight?.title,
			playbacks: highlight?.playbacks,
			poster: highlight?.image?.cuts.find((cut) => cut.width <= 1280)?.src,
		}
	}
</script>

<figure class="grid gap-ch max-md:full-bleed">
	{#await fetchHighlight()}
		<Loading class="mb-lh aspect-video justify-center bg-current/5 text-current/50">
			Loading video...
		</Loading>
	{:then { title, playbacks, poster }}
		<Video class="aspect-video w-full bg-current/10" {playbacks} {poster} />
		<figcaption class="text-center text-sm text-current/50">{title}</figcaption>
	{/await}
</figure>
