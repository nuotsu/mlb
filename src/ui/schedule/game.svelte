<script lang="ts">
	import { fetchMLB } from '$lib/fetch'
	import { formatDate } from '$lib/temporal'
	import { cn } from '$lib/utils'
	import Loading from '$ui/loading.svelte'
	import Linescore from '$ui/schedule/linescore.svelte'
	import Team from '$ui/schedule/team.svelte'

	let { game }: { game: MLB.Game } = $props()

	async function fetchBoxscore() {
		return await fetchMLB<MLB.Boxscore>(`/api/v1/game/${game.gamePk}/boxscore`, {
			fields: 'teams,away,team,id,name,teamName',
		})
	}
</script>

<article class="group/game grid items-end" data-gamePk={game.gamePk}>
	<div
		class="relative grid h-6 w-[8ch] place-content-center overflow-x-clip text-center text-sm tabular-nums *:leading-none group-has-[[style*=linescore]]/game:h-12"
		style:grid-area="status"
	>
		{#if game.status.abstractGameState === 'Final'}
			<span>
				{game.status.reason || game.status.detailedState || game.status.abstractGameState}
			</span>
		{:else}
			<time datetime={game.gameDate}>
				{formatDate(game.gameDate, { hour: '2-digit', minute: '2-digit' })}
			</time>
		{/if}

		<a
			class={cn(
				'absolute inset-0 grid place-content-center leading-tight backdrop-blur transition-[translate,opacity] group-not-hover/game:-translate-x-full group-not-hover/game:opacity-0',
			)}
			href="/game/{game.gamePk}"
		>
			View details
		</a>
	</div>

	<small class="grid items-end text-center sm:h-rlh font-light" style:grid-area="description">
		<span class="line-clamp-1">
			{#if game.description}
				{game.description}
			{:else if game.seriesGameNumber && game.gamesInSeries}
				Series {game.seriesGameNumber} of {game.gamesInSeries}
			{/if}
		</span>
	</small>

	<div style:grid-area="boxscore">
		{#await fetchBoxscore()}
			<Loading>Loading...</Loading>
		{:then boxscore}
			{#if game.status.abstractGameState === 'Final'}
				<div class="grid text-left">
					<Team team={boxscore.teams.away.team} class="pr-ch">
						{@render score(game.teams.away.score)}
					</Team>
					<Team team={boxscore.teams.home.team} class="pr-ch">
						{@render score(game.teams.home.score)}
					</Team>
				</div>
			{:else}
				<div class="grid grid-cols-2 text-center">
					<Team team={boxscore.teams.away.team} class="flex-row-reverse pl-ch" />
					<Team team={boxscore.teams.home.team} class="pr-ch" />
				</div>
			{/if}
		{/await}
	</div>

	{#if game.status.abstractGameState === 'Final'}
		<Linescore {game} />
	{/if}
</article>

{#snippet score(score?: number)}
	<strong class="text-right tabular-nums">{score}</strong>
{/snippet}

<style>
	article {
		grid-template:
			'status description' 1fr
			'status	boxscore' auto / auto 1fr;

		&:global(:has([style*='linescore'])) {
			grid-template:
				'status description linescore' 1fr
				'status	boxscore linescore' auto / auto 1fr 1fr;

			@media (width < 32rem) {
				grid-template:
					'. description description' auto
					'status boxscore linescore' 1fr / auto 6ch 1fr;
			}
		}
	}
</style>
