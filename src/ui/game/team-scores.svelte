<script lang="ts">
	import StyledTeam from '$ui/team/styled-team.svelte'

	let { game, boxscore }: { game: MLB.Game; boxscore: MLB.Boxscore } = $props()
</script>

{#if game.status.abstractGameState === 'Final'}
	<div class="grid text-left">
		<StyledTeam team={boxscore.teams.away.team} record={game.teams.away.leagueRecord} linked>
			{@render score(game.teams.away.score)}
		</StyledTeam>

		<StyledTeam team={boxscore.teams.home.team} record={game.teams.home.leagueRecord} linked>
			{@render score(game.teams.home.score)}
		</StyledTeam>
	</div>
{:else}
	<div class="grid grid-cols-2 text-center">
		<StyledTeam
			class="flex-row-reverse pl-[.5ch] *:data-name:order-last [&_picture]:ml-auto"
			team={boxscore.teams.away.team}
			record={game.teams.away.leagueRecord}
			linked
		/>
		<StyledTeam
			class="pr-[.5ch] *:data-name:order-last [&_picture]:mr-auto"
			team={boxscore.teams.home.team}
			record={game.teams.home.leagueRecord}
			linked
		/>
	</div>
{/if}

{#snippet score(score?: number)}
	<strong class="ml-auto shrink-0 pr-[.5ch] text-right font-sans tabular-nums">{score}</strong>
{/snippet}
