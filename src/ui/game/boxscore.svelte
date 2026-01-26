<script lang="ts">
	let { feedLive, boxscore }: { feedLive: MLB.LiveGameFeed; boxscore: MLB.Boxscore } = $props()

	let { away, home } = $derived(boxscore.teams)
	let { players } = $derived(feedLive.gameData)
</script>

<article class="grid grid-cols-2">
	{@render team(away)}
	{@render team(home)}
</article>

{#snippet team(team: MLB.TeamBoxscore)}
	<div>
		<h2>{team.team.abbreviation}</h2>
		<ol>
			{#each team.battingOrder as playerId}
				{@const { lastName } = players[`ID${playerId}`] as unknown as MLB.Person}
				{@const { position } = team.players[`ID${playerId}`]}
				<li class="grid grid-cols-[3ch_1fr]">
					<span class="text-center">{position.abbreviation}</span>
					{lastName}
				</li>
			{/each}
		</ol>
	</div>
{/snippet}
