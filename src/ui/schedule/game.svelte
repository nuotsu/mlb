<script lang="ts">
	import { fetchMLB } from '$lib/fetch'
	import { formatDate } from '$lib/temporal'

	let { game }: { game: MLB.Game } = $props()

	async function fetchBoxscore() {
		return await fetchMLB<MLB.Boxscore>(`/api/v1/game/${game.gamePk}/boxscore`, {
			fields: 'teams,away,team,teamName',
		})
	}
</script>

<article class="grid grid-cols-[auto_1fr] items-center gap-ch" data-gamePk={game.gamePk}>
	<time class="self-start text-sm leading-rlh tabular-nums" datetime={game.gameDate}>
		{formatDate(game.gameDate, { hour: '2-digit', minute: '2-digit' })}
	</time>

	{#await fetchBoxscore() then boxscore}
		<div>
			<span class="inline-block">{boxscore.teams.away.team.teamName}</span>
			@
			<span class="inline-block">{boxscore.teams.home.team.teamName}</span>

			{#if game.description}
				<small class="inline-block">({game.description})</small>
			{/if}
		</div>
	{/await}
</article>
