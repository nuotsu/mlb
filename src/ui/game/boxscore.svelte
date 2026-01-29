<script lang="ts">
	import { cn } from '$lib/utils'
	import StyledTeam from '../team/styled-team.svelte'

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
		<StyledTeam team={team.team} />
		<ol>
			{#each team.batters as playerId (playerId)}
				{@const { lastName } = players[`ID${playerId}`] as unknown as MLB.Person}
				{@const { position } = team.players[`ID${playerId}`]}
				{@const isSubstituted = !team.battingOrder.includes(playerId)}

				{#if position.abbreviation !== 'P'}
					<li class="grid grid-cols-[3ch_1fr]" data-substituted={isSubstituted ? '' : undefined}>
						<span class="text-center">{position.abbreviation}</span>
						{lastName}
					</li>
				{/if}
			{/each}
		</ol>
	</div>
{/snippet}

<style>
	[data-substituted] + li {
		margin-left: 2ch;
	}
</style>
