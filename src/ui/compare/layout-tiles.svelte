<script lang="ts">
	import {
		VERDICT_CLASS,
		type ComparePlayer,
		type CompareRow,
		type CompareSection,
	} from '#lib/compare.js'
	import { cn } from '#lib/utils.js'
	import Headshot from '#ui/player/headshot.svelte'

	let { players, sections }: { players: ComparePlayer[]; sections: CompareSection[] } = $props()

	/** Best first; players without a value sink to the bottom */
	function ranked({ def, cells }: CompareRow) {
		return cells
			.map((cell, i) => ({ cell, player: players[i] }))
			.toSorted((a, b) => {
				if (a.cell.value == null) return 1
				if (b.cell.value == null) return -1
				if (def.neutral) return 0
				return def.lower ? a.cell.value - b.cell.value : b.cell.value - a.cell.value
			})
	}
</script>

<div class="space-y-lh">
	{#each sections as { id, label, rows } (id)}
		<section>
			<h2 class="mb-[.5ch] text-xs tracking-wide text-current/50 uppercase">{label}</h2>

			<ul class="grid grid-cols-[repeat(auto-fill,minmax(min(100%,20ch),1fr))] gap-ch">
				{#each rows as row (row.def.key)}
					<li class="border border-stroke">
						<header
							class="flex items-baseline justify-between gap-ch border-b border-stroke px-ch py-[.25ch]"
							title={row.def.label}
						>
							<span class="font-bold">{row.def.abbr}</span>
							<span class="line-clamp-1 text-xs text-current/50">{row.def.label}</span>
						</header>

						<ol>
							{#each ranked(row) as { cell, player } (player.id)}
								<li
									class={cn(
										'flex items-center gap-ch px-ch py-[.25ch]',
										cell.verdict && VERDICT_CLASS[cell.verdict],
									)}
								>
									<Headshot class="size-lh shrink-0" person={player} size={48} />
									<span class="line-clamp-1 grow">{player.fullName.split(' ').at(-1)}</span>
									<span class="font-bold tabular-nums">{cell.display}</span>
								</li>
							{/each}
						</ol>
					</li>
				{/each}
			</ul>
		</section>
	{/each}
</div>
