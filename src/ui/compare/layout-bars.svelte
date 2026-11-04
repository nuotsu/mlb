<script lang="ts">
	import {
		VERDICT_CLASS,
		VERDICT_FILL,
		type Cell,
		type ComparePlayer,
		type CompareSection,
	} from '#lib/compare.js'
	import { cn } from '#lib/utils.js'
	import Headshot from '#ui/player/headshot.svelte'

	let { players, sections }: { players: ComparePlayer[]; sections: CompareSection[] } = $props()

	let mirrored = $derived(players.length === 2)
</script>

{#snippet bar(cell: Cell, reverse = false)}
	<div class={cn('flex h-lh items-center gap-[.5ch]', reverse && 'flex-row-reverse')}>
		<span
			class={cn(
				'shrink-0 rounded-sm px-[.5ch] tabular-nums',
				cell.verdict && VERDICT_CLASS[cell.verdict],
			)}
		>
			{cell.display}
		</span>
		<span class={cn('flex h-[.6lh] grow', reverse && 'justify-end')}>
			<span
				class={cn(
					'block h-full rounded-sm transition-[width] duration-500',
					cell.verdict ? VERDICT_FILL[cell.verdict] : 'bg-current/20',
				)}
				style:width="{cell.share * 100}%"
			></span>
		</span>
	</div>
{/snippet}

<div class="mx-auto max-w-3xl space-y-lh">
	{#if mirrored}
		<header
			class="sticky top-(--header-height) z-1 grid grid-cols-2 bg-background/80 py-[.5ch] backdrop-blur-xs"
		>
			{#each players as { id, fullName }, i (id)}
				<a
					class={cn(
						'flex min-w-0 items-center gap-ch hover-link',
						i === 1 && 'flex-row-reverse justify-self-end text-right',
					)}
					href="/player/{id}"
				>
					<Headshot class="size-[1.5lh] shrink-0" person={{ id, fullName }} size={72} />
					<span class="line-clamp-1 font-bold">{fullName}</span>
				</a>
			{/each}
		</header>
	{/if}

	{#each sections as { id, label, rows } (id)}
		<section>
			<h2 class="mb-[.5ch] text-center text-xs tracking-wide text-current/50 uppercase">{label}</h2>

			<ul class="divide-y divide-stroke border-y border-stroke">
				{#each rows as { def, cells } (def.key)}
					{#if mirrored}
						<li class="grid grid-cols-[1fr_9ch_1fr] items-center gap-ch py-[.25ch]">
							{@render bar(cells[0], true)}
							<span class="text-center leading-tight" title={def.label}>
								<span class="block font-bold">{def.abbr}</span>
								{#if def.lower}<span class="block text-[10px] text-current/40">lower is better</span
									>{/if}
							</span>
							{@render bar(cells[1])}
						</li>
					{:else}
						<li class="grid gap-x-ch py-[.5ch] sm:grid-cols-[14ch_1fr]">
							<div title={def.label}>
								<span class="font-bold">{def.abbr}</span>
								<span class="text-current/50 sm:block">{def.label}</span>
							</div>
							<div>
								{#each cells as cell, i (players[i].id)}
									<div class="grid grid-cols-[10ch_1fr] items-center gap-ch">
										<span class="line-clamp-1 text-current/60"
											>{players[i].fullName.split(' ').at(-1)}</span
										>
										{@render bar(cell)}
									</div>
								{/each}
							</div>
						</li>
					{/if}
				{/each}
			</ul>
		</section>
	{/each}
</div>
