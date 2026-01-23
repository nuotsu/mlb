<script lang="ts">
	import StyledTeam from '$ui/game/styled-team.svelte'

	let { game, boxscore }: { game: MLB.Game; boxscore: MLB.Boxscore } = $props()
</script>

{#if game.status.abstractGameState === 'Final'}
	<div class="grid text-left">
		<StyledTeam team={boxscore.teams.away.team} class="pr-ch">
			{@render score(game.teams.away.score)}
		</StyledTeam>
		<StyledTeam team={boxscore.teams.home.team} class="pr-ch">
			{@render score(game.teams.home.score)}
		</StyledTeam>
	</div>
{:else}
	<div class="grid grid-cols-2 text-center">
		<StyledTeam team={boxscore.teams.away.team} class="flex-row-reverse pl-ch" />
		<StyledTeam team={boxscore.teams.home.team} class="pr-ch" />
	</div>
{/if}

{#snippet score(score?: number)}
	<strong class="shrink-0 text-right font-sans tabular-nums">{score}</strong>
{/snippet}
