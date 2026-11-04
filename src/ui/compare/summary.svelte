<script lang="ts">
	import type { ComparePlayer } from '#lib/compare.js'
	import { cn } from '#lib/utils.js'
	import { compareStore } from '#ui/compare/store.svelte.js'
	import { CloseIcon } from '#ui/icons/index.js'
	import Headshot from '#ui/player/headshot.svelte'
	import Logo from '#ui/team/logo.svelte'

	let { players, leads, ranked }: { players: ComparePlayer[]; leads: number[]; ranked: number } =
		$props()

	let top = $derived(Math.max(...leads))
</script>

<ul class="grid grid-cols-[repeat(auto-fit,minmax(min(100%,24ch),1fr))] gap-ch">
	{#each players as { id, fullName, position, teamId }, i (id)}
		{@const leader = ranked > 0 && leads[i] === top && leads.filter((l) => l === top).length === 1}
		<li
			class={cn(
				'relative flex items-center gap-ch border border-stroke p-[.5ch] sm:p-ch',
				leader && 'border-green-500/50 bg-green-500/10',
			)}
		>
			<Headshot
				class="size-[1.75lh] shrink-0 sm:size-[2.5lh]"
				person={{ id, fullName }}
				size={120}
			/>

			<div class="min-w-0 grow">
				<a class="line-clamp-1 font-bold hover-link" href="/player/{id}">{fullName}</a>

				<p class="flex items-center gap-[.5ch] text-current/60">
					{#if teamId}
						<Logo class="size-[1em]" team={{ id: teamId } as MLB.Team} />
					{/if}
					{position}
				</p>

				{#if ranked}
					<p class="flex items-center gap-ch">
						<span class={cn('tabular-nums', leader && 'positive')}>
							Leads {leads[i]} of {ranked}
						</span>
						<span
							class="h-[.5ch] grow overflow-hidden rounded-full bg-current/10"
							aria-hidden="true"
						>
							<span
								class={cn(
									'block h-full rounded-full',
									leader ? 'bg-green-500/70' : 'bg-current/30',
								)}
								style:width="{(leads[i] / ranked) * 100}%"
							></span>
						</span>
					</p>
				{/if}
			</div>

			<button
				class="absolute top-[.5ch] right-[.5ch] text-current/40 hover:text-current"
				type="button"
				title="Remove {fullName}"
				aria-label="Remove {fullName}"
				onclick={() => compareStore.remove(id)}
			>
				<CloseIcon />
			</button>
		</li>
	{/each}
</ul>
