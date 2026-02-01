<script lang="ts">
	import StyledTeam from '$ui/team/styled-team.svelte'

	let { feedLive, boxscore }: { feedLive: MLB.LiveGameFeed; boxscore: MLB.Boxscore } = $props()

	let { away, home } = $derived(boxscore.teams)

	$inspect(boxscore)
</script>

<article
	class="grid snap-x snap-mandatory auto-cols-[min(var(--container-sm),calc(100vw-2ch))] grid-flow-col overflow-x-auto sm:grid-cols-2"
>
	{@render team(away)}
	{@render team(home)}
</article>

{#snippet team(team: MLB.TeamBoxscore)}
	<div class="snap-start">
		<StyledTeam
			team={team.team}
			class="max-sm:[&_picture]:sticky max-sm:[&_picture]:left-0 max-sm:[&_picture]:-z-1"
		/>

		<table>
			<thead class="text-xs text-current/50">
				<tr>
					<th class="w-full"></th>
					<th>AB</th>
				</tr>
			</thead>
			<tbody>
				{#each team.batters as playerId (playerId)}
					{@const { position, person } = team.players[`ID${playerId}`]}
					{@const isSubstituted = !team.battingOrder.includes(playerId)}
					{#if position.abbreviation !== 'P'}
						<tr data-substituted={isSubstituted ? '' : undefined}>
							<td>
								<small class="inline-block w-[3ch] text-center text-xs text-current/50">
									{position.abbreviation}
								</small>
								{person.boxscoreName}
							</td>
							<td></td>
						</tr>
					{/if}
				{/each}
			</tbody>
		</table>

		<hr class="my-[.5ch] border-dashed border-current/25" />

		<table>
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
						<tr class="grid grid-cols-[auto_1fr] items-center gap-[.5ch]">
							<td>
								<small class="inline-block w-[3ch] text-center text-xs text-current/50">
									{position.abbreviation}
								</small>
								{person.boxscoreName}
							</td>
						</tr>
					{/if}
				{/each}
			</tbody>
		</table>
	</div>
{/snippet}

<style>
	th {
		font-weight: normal;
	}

	[data-substituted] + tr td {
		padding-left: 2ch;
	}
</style>
