<script lang="ts">
	import { CollapseIcon, ExpandIcon } from '$ui/icons'

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

			{#each items as { title, playbacks }}
				{@const { url } = playbacks?.[0] ?? {}}

				<figure
					class="w-full space-y-ch transition-opacity group-not-has-checked/highlight:hidden starting:opacity-0"
				>
					<video id={`highlights-${i}`} src={url} controls>
						<track kind="captions" />
					</video>

					<figcaption class="px-ch">{title}</figcaption>
				</figure>
			{/each}
		</div>
	{/each}

	<label
		class="group/theater absolute right-0 bottom-0 grid h-lh place-content-center max-md:hidden"
		title="Theater mode"
	>
		<input id="theater-mode" type="checkbox" bind:checked={theaterMode} hidden />
		<ExpandIcon class="group-has-checked/theater:hidden" />
		<CollapseIcon class="group-not-has-checked/theater:hidden" />
	</label>
</article>
