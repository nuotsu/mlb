<script lang="ts">
	import { CollapseIcon, ExpandIcon } from '$ui/icons'
	import Video from '$ui/video.svelte'

	let { content }: { content: MLB.GameContent } = $props()

	let highlights = $derived(content.media.epgAlternate)

	let theaterMode = $state(false)
</script>

<svelte:window
	onkeydown={({ key }) => {
		if (key === 't') theaterMode = !theaterMode
	}}
/>

<article class="relative flex flex-wrap gap-ch text-center has-[#theater-mode:checked]:order-first">
	{#each highlights as { title, items }, i}
		<div class="group/highlight contents">
			<input
				name="highlights"
				id="highlights-{i}"
				type="radio"
				value={i}
				checked={title === 'Daily Recap' || i === 0}
				onchange={() => {
					document.querySelectorAll('video')?.forEach((video) => {
						if (video.id !== `highlights-${i}`) video.pause()
					})
				}}
				hidden
			/>

			<label
				for="highlights-{i}"
				class="order-first grow px-ch decoration-dashed transition-colors hover:text-current! [:checked+&]:underline [:not(:checked)+&]:text-current/25"
			>
				{title}
			</label>

			{#each items as { title, playbacks, image }}
				{@const poster = image?.cuts.find((cut) => cut.width <= 1280)?.src}

				<figure
					class="w-full space-y-ch transition-opacity group-not-has-checked/highlight:hidden starting:opacity-0"
				>
					<Video
						class="aspect-video w-full bg-current/10"
						id={`highlights-${i}`}
						{playbacks}
						{poster}
					/>

					<figcaption class="px-ch">{title}</figcaption>
				</figure>
			{/each}
		</div>
	{/each}

	<label
		class="group/theater absolute right-0 bottom-0 grid h-lh place-content-center not-hover:text-current/50 not-hover:transition-colors max-md:hidden"
		title="Theater mode (t)"
	>
		<input id="theater-mode" type="checkbox" bind:checked={theaterMode} hidden />
		<ExpandIcon class="group-has-checked/theater:hidden" />
		<CollapseIcon class="group-not-has-checked/theater:hidden" />
	</label>
</article>
