<script lang="ts">
	import { VERDICT_CLASS, type ComparePlayer, type CompareSection } from '#lib/compare.js'
	import { cn } from '#lib/utils.js'
	import Headshot from '#ui/player/headshot.svelte'

	let { players, sections }: { players: ComparePlayer[]; sections: CompareSection[] } = $props()
</script>

<div class="overflow-x-auto overscroll-x-contain">
	<table class="w-full border-collapse tabular-nums">
		<thead>
			<tr class="border-b border-stroke">
				<th class="sticky left-0 z-1 bg-background text-left" scope="col">
					<span class="sr-only">Stat</span>
				</th>
				{#each players as { id, fullName } (id)}
					<th class="min-w-[10ch] p-[.5ch] align-bottom" scope="col">
						<a class="flex flex-col items-center gap-[.25ch] hover-link" href="/player/{id}">
							<Headshot class="size-[1.5lh]" person={{ id, fullName }} size={72} />
							<span class="line-clamp-1 break-all">{fullName.split(' ').at(-1)}</span>
						</a>
					</th>
				{/each}
			</tr>
		</thead>

		{#each sections as { id, label, rows } (id)}
			<tbody>
				<tr>
					<th
						class="sticky left-0 bg-background px-ch pt-lh pb-[.25ch] text-left text-xs tracking-wide text-current/50 uppercase"
						colspan={players.length + 1}
						scope="colgroup"
					>
						{label}
					</th>
				</tr>

				{#each rows as { def, cells } (def.key)}
					<tr class="border-t border-stroke hover:bg-current/5">
						<th
							class="sticky left-0 bg-background px-ch py-[.25ch] text-left"
							scope="row"
							title={def.label}
						>
							<span class="font-bold">{def.abbr}</span>
							<span class="text-current/50 max-sm:hidden">{def.label}</span>
						</th>
						{#each cells as cell, i (players[i].id)}
							<td
								class={cn(
									'px-ch py-[.25ch] text-center',
									cell.verdict && VERDICT_CLASS[cell.verdict],
								)}
							>
								{cell.display}
							</td>
						{/each}
					</tr>
				{/each}
			</tbody>
		{/each}
	</table>
</div>
