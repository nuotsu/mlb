<script lang="ts">
	import { formatDate, formatRelativeDays } from '$lib/temporal'
	import Headshot from '$ui/player/headshot.svelte'
	import type { InjuredPlayer } from './injured-list'

	let { players }: { players: InjuredPlayer[] } = $props()
</script>

<dl class="grid px-rch max-sm:px-ch">
	<dt class="col-span-full grid grid-cols-subgrid gap-x-ch text-sm text-current/50 max-sm:hidden">
		<span class="col-start-2">Player</span>
		<span class="col-start-3">Reason</span>
		<span class="col-start-4 text-right">Exp. Return</span>
	</dt>

	{#each players as player (player.person.id)}
		<dd class="col-span-full grid grid-cols-subgrid items-center gap-x-ch hover:bg-current/10">
			<span
				class="col-start-1 row-start-1 w-[5rch] text-center text-sm"
				title={player.status.description}
			>
				{player.label}
			</span>

			<a
				class="col-span-2 col-start-2 row-start-1 flex grow items-center gap-x-ch decoration-dashed hover:underline sm:col-span-1"
				href="/player/{player.person.id}"
			>
				<Headshot person={player.person} size={72} class="size-lh shrink-0" />

				<span class="line-clamp-1 break-all">{player.person.lastFirstName}</span>
			</a>

			{#if player.reason}
				<small
					class="col-start-2 row-start-2 line-clamp-1 break-all text-current/70 sm:col-start-3 sm:row-start-1"
				>
					{player.reason}
				</small>
			{/if}

			{#if player.eligibleDate}
				<small class="col-start-3 row-start-2 shrink-0 text-right sm:col-start-4 sm:row-start-1">
					{formatDate(player.eligibleDate, { month: 'short', day: 'numeric' })}
					<span class="text-current/50">({formatRelativeDays(player.eligibleDate)})</span>
				</small>
			{:else if player.daysOnIL != null}
				<small class="col-start-3 row-start-2 shrink-0 text-right sm:col-start-4 sm:row-start-1">
					{player.label}
					<span class="text-current/50">({player.daysOnIL}d)</span>
				</small>
			{/if}
		</dd>
	{/each}
</dl>

<style>
	dl {
		grid-template-columns: auto 1fr auto;
	}

	@media (width >= 40rem) {
		dl {
			grid-template-columns: auto 1fr minmax(0, 1fr) auto;
		}
	}
</style>
