<script lang="ts">
	import { fetchMLB } from '$lib/fetch'
	import { formatDate } from '$lib/temporal'
	import Loading from '$ui/loading.svelte'
	import Team from '$ui/schedule/team.svelte'

	let { game }: { game: MLB.Game } = $props()

	async function fetchBoxscore() {
		return await fetchMLB<MLB.Boxscore>(`/api/v1/game/${game.gamePk}/boxscore`, {
			fields: 'teams,away,team,id,name,teamName,sport',
		})
	}
</script>

<article class="grid items-center gap-x-ch" data-gamePk={game.gamePk}>
	<time
		datetime={game.gameDate}
		class="grid w-[8ch] place-content-center text-center text-sm leading-none tabular-nums"
		style:grid-area="status"
	>
		{#if game.status.abstractGameState === 'Final'}
			{game.status.reason || game.status.detailedState || game.status.abstractGameState}
		{:else}
			{formatDate(game.gameDate, { hour: '2-digit', minute: '2-digit' })}
		{/if}
	</time>

	<small class="grid items-end text-center sm:h-rlh" style:grid-area="description">
		{game.description}
	</small>

	<div style:grid-area="boxscore">
		{#await fetchBoxscore()}
			<Loading>Loading...</Loading>
		{:then boxscore}
			<div class="grid grid-cols-2">
				<Team team={boxscore.teams.away.team} />
				<Team team={boxscore.teams.home.team} />
			</div>
		{/await}
	</div>
</article>

<style>
	article {
		grid-template:
			'. description' 1fr
			'status	boxscore' auto / auto 1fr;
	}
</style>
