<script lang="ts">
	import { cn } from '$lib/utils'
	import StyledTeam from '$ui/team/styled-team.svelte'

	let { boxscore }: { boxscore: MLB.Boxscore } = $props()

	let { away, home } = $derived(boxscore.teams)
</script>

<article
	class="grid snap-x snap-mandatory auto-cols-[min(var(--container-sm),calc(100vw-2ch))] grid-flow-col overflow-x-auto sm:grid-cols-2"
>
	{@render team(away)}
	{@render team(home)}
</article>

{#snippet team(team: MLB.TeamBoxscore)}
	<article class="snap-start">
		<StyledTeam
			team={team.team}
			class="max-sm:[&_picture]:sticky max-sm:[&_picture]:left-0 max-sm:[&_picture]:-z-1"
		/>

		<div class="overflow-x-auto whitespace-nowrap">
			<table class="text-center">
				<thead class="text-xs text-current/50">
					<tr>
						<th class="w-full"></th>
						<th>AB</th>
						<th>H</th>
						<th>R</th>
						<th>RBI</th>
						<th>BB</th>
						<th>K</th>
					</tr>
				</thead>
				<tbody>
					{#each team.batters as playerId (playerId)}
						{@const { position, person, stats } = team.players[`ID${playerId}`]}
						{@const { atBats, hits, runs, rbi, baseOnBalls, strikeOuts } = stats?.batting ?? {}}

						{#if position.abbreviation !== 'P'}
							<tr
								class="hover:*:bg-foreground/10"
								data-substituted={!team.battingOrder.includes(playerId) ? '' : undefined}
							>
								<th class="sticky left-0 text-left backdrop-blur">
									<small class="inline-block w-[3ch] text-center text-xs text-current/50">
										{position.abbreviation}
									</small>
									{person.boxscoreName}
								</th>

								<td>{atBats}</td>
								<td class={cn(Number(hits) === 0 && 'text-current/50')}>{hits}</td>
								<td>{runs}</td>
								<td>{rbi}</td>
								<td>{baseOnBalls}</td>
								<td>{strikeOuts}</td>
							</tr>
						{/if}
					{/each}
				</tbody>
			</table>
		</div>

		<hr class="my-[.5ch] border-dashed border-current/25" />

		<table class="text-center">
			<thead class="text-xs text-current/50">
				<tr>
					<th class="w-full"></th>
					<th>IP</th>
				</tr>
			</thead>
			<tbody>
				{#each team.pitchers as playerId (playerId)}
					{@const { position, person } = team.players[`ID${playerId}`]}
					{#if position.abbreviation === 'P'}
						<tr class="hover:*:bg-foreground/10">
							<th class="sticky left-0 text-left backdrop-blur">
								<small class="inline-block w-[3ch] text-center text-xs text-current/50">
									{position.abbreviation}
								</small>
								{person.boxscoreName}
							</th>
							<td></td>
						</tr>
					{/if}
				{/each}
			</tbody>
		</table>
	</article>
{/snippet}

<style>
	th {
		font-weight: normal;
		min-width: 3rch;
	}

	td {
		font-family: var(--font-sans);
		font-variant-numeric: tabular-nums;
	}

	[data-substituted] + tr th {
		padding-left: 2ch;
	}
</style>
