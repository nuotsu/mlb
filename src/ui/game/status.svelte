<script lang="ts">
	import { formatDate } from '$lib/temporal'
	import { cn } from '$lib/utils'
	import Inning from './inning.svelte'

	let {
		game,
		liveGame,
		linescore,
		isSpoilerPrevented,
	}: {
		game: MLB.Game
		liveGame?: MLB.LiveGameFeed
		linescore?: MLB.Linescore
		isSpoilerPrevented: boolean
	} = $props()
</script>

{#if game.status.abstractGameState === 'Final' && !isSpoilerPrevented}
	{@const value = game.status.reason || game.status.detailedState || game.status.abstractGameState}
	{@const isExtraInnings = value === 'Final' && linescore?.currentInning! > linescore?.scheduledInnings!}
	<b class={cn(value.includes(':') ? 'text-[x-small]' : 'text-xs')}>
		<span>{isExtraInnings ? 'F' : value}</span
		>{#if isExtraInnings}/{linescore?.currentInning}{/if}
	</b>
{:else if game.status.abstractGameState === 'Live' && !isSpoilerPrevented}
	<Inning linescore={liveGame?.liveData?.linescore} />
{:else}
	<time class="text-xs font-bold" datetime={game.gameDate}>
		{formatDate(game.gameDate, { hour: 'numeric', minute: '2-digit' })}
	</time>
{/if}

<style>
	b,
	time {
		position: absolute;
		inset: 50% 0 auto;
		translate: 0 -50%;
		width: 100%;
		padding-inline: 0.5ch;

		span {
			hyphens: auto;
		}
	}
</style>
