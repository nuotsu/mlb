<script lang="ts">
	import { CollapseHorizontalIcon, ExpandHorizontalIcon } from '#ui/icons/index.js'
	import Video from '#ui/video.svelte'
	import { untrack } from 'svelte'
	import type { HTMLAttributes } from 'svelte/elements'

	let {
		game: _game,
		content,
		theater = true,
		class: className,
	}: {
		game: MLB.Game
		content: MLB.GameContent | null
		theater?: boolean
	} & HTMLAttributes<HTMLDivElement> = $props()

	let highlights = $derived(content?.highlights.highlights?.items.filter((h) => h.type === 'video'))

	let selectedIndex = $state(
		untrack(() => Math.max(0, highlights?.findIndex((h) => h.type === 'video') ?? 0)),
	)

	let grouped = $derived(
		[
			...(highlights ?? [])
				.map((h, i) => ({
					index: i,
					title: h.title,
					player: h.keywordsAll?.find((k) => k.type === 'player')?.displayName ?? '',
				}))
				.reduce((acc, item) => {
					if (!acc.has(item.player)) acc.set(item.player, [])
					acc.get(item.player)!.push(item)
					return acc
				}, new Map<string, { index: number; title: string }[]>())
				.entries(),
		]
			.sort(([a], [b]) => (!a ? 1 : !b ? -1 : a.localeCompare(b)))
			.map(([player, items]) => ({ player, items })),
	)

	let theaterMode = $state(false)
</script>

<svelte:window
	onkeydown={({ key }) => {
		if (key === 't') theaterMode = !theaterMode
	}}
/>

{#if highlights?.length}
	<article class="relative grid gap-ch text-center sm:px-ch {className}">
		<div class="flex items-center gap-ch">
			<select
				class="order-first button w-full"
				bind:value={selectedIndex}
				onchange={() => document.querySelectorAll('video')?.forEach((v) => v.pause())}
			>
				{#each grouped as { player, items } (player)}
					{#if player}
						<optgroup label={player}>
							{#each items as { index, title } (index)}
								<option value={index}>{title}</option>
							{/each}
						</optgroup>
					{:else}
						<optgroup label="Other">
							{#each items as { index, title } (index)}
								<option value={index}>{title}</option>
							{/each}
						</optgroup>
					{/if}
				{/each}
			</select>

			{#if theater}
				<label
					class="group/theater grid h-lh shrink-0 place-content-center not-hover:text-current/50 not-hover:transition-colors max-md:hidden"
					title="Theater mode (t)"
				>
					<input class="sr-only" id="theater-mode" type="checkbox" bind:checked={theaterMode} />
					<ExpandHorizontalIcon class="group-has-checked/theater:hidden" />
					<CollapseHorizontalIcon class="group-not-has-checked/theater:hidden" />
				</label>
			{/if}
		</div>

		{#each highlights as { playbacks, image }, i (i)}
			{#if selectedIndex === i}
				{@const poster = image?.cuts.find((cut) => cut.width <= 1280)?.src}

				<figure class="w-full space-y-ch text-balance italic transition-opacity starting:opacity-0">
					<Video
						class="aspect-video w-full bg-current/10"
						id={`highlights-${i}`}
						{playbacks}
						{poster}
					/>
				</figure>
			{/if}
		{/each}
	</article>
{/if}
