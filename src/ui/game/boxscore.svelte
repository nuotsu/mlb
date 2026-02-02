<script lang="ts">
	import { cn } from '$lib/utils'
	import { ArrowDownRightIcon } from '$ui/icons'
	import Headshot from '$ui/player/headshot.svelte'
	import StyledTeam from '$ui/team/styled-team.svelte'

	let { boxscore }: { boxscore: MLB.Boxscore } = $props()

	let { away, home } = $derived(boxscore.teams)
</script>

<article
	class="col-span-full grid snap-x snap-mandatory auto-cols-[min(var(--container-sm),calc(100vw-2ch))] grid-flow-col overflow-x-auto sm:grid-cols-2 md:group-has-[#theater-mode:not(:checked)]/details:order-last"
>
	{@render team(away)}
	{@render team(home)}
</article>

{#snippet team(team: MLB.TeamBoxscore)}
	<article class="snap-center">
		<StyledTeam team={team.team} />

		<div class="overflow-x-auto whitespace-nowrap">
			<table class="table-fixed text-center">
				<thead class="text-xs text-current/40">
					<tr>
						<th class="w-full"></th>
						<th>AB</th>
						<th>H</th>
						<th>R</th>
						<th>RBI</th>
						<th>HR</th>
						<th>BB</th>
						<th>K</th>
					</tr>
				</thead>
				<tbody>
					{#each team.batters as playerId (playerId)}
						{@const { stats, ...player } = team.players[`ID${playerId}`]}
						{@const substituted = !team.battingOrder.includes(playerId)}

						{#if player.position.abbreviation !== 'P'}
							<tr class="hover:*:bg-foreground/10" data-substituted={substituted ? '' : undefined}>
								{@render p(player, substituted)}

								{#each ['atBats', 'hits', 'runs', 'rbi', 'homeRuns', 'baseOnBalls', 'strikeOuts'] as stat}
									{@const value = stats?.batting?.[stat as keyof MLB.BattingStats]}
									<td class={cn(Number(value) === 0 && 'text-current/40')}>{value}</td>
								{/each}
							</tr>
						{/if}
					{/each}
				</tbody>
			</table>
		</div>

		<hr class="my-[.5ch] border-dashed border-current/25" />

		<table class="table-fixed text-center">
			<thead class="text-xs text-current/40">
				<tr>
					<th class="w-full"></th>
					<th>IP</th>
					<th>P</th>
					<th>H</th>
					<th>R</th>
					<th>ER</th>
					<th>K</th>
					<th>HR</th>
				</tr>
			</thead>
			<tbody>
				{#each team.pitchers as playerId (playerId)}
					{@const { stats, ...player } = team.players[`ID${playerId}`]}
					{#if player.position.abbreviation === 'P'}
						<tr class="hover:*:bg-foreground/10">
							{@render p(player)}

							{#each ['inningsPitched', 'numberOfPitches', 'hits', 'runs', 'earnedRuns', 'strikeOuts', 'homeRuns'] as stat}
								{@const value = stats?.pitching?.[stat as keyof MLB.PitchingStats]}
								<td class={cn(Number(value) === 0 && 'text-current/40')}>{value}</td>
							{/each}
						</tr>
					{/if}
				{/each}
			</tbody>
		</table>
	</article>
{/snippet}

{#snippet p({ position, person }: MLB.BoxscorePlayer, substituted?: boolean)}
	<th class="relative min-w-[14ch] text-left">
		<a href="/person/{person.id}" class="group/player flex items-center gap-ch">
			<Headshot {person} class="sticky -left-ch z-1 size-lh" />

			<span class="line-clamp-1 break-all decoration-dashed group-hover/player:underline">
				{person.boxscoreName}
			</span>

			<small class="text-xs text-current/40 no-underline">
				{position.abbreviation}
			</small>

			<span class="absolute inset-0"></span>

			{#if substituted}
				<div class="absolute top-full left-ch grid size-lh place-content-center">
					<ArrowDownRightIcon class="size-ch text-current/40" />
				</div>
			{/if}
		</a>
	</th>
{/snippet}

<style>
	table tr {
		> :first-child {
			padding-left: 1rch;
		}
		> :last-child {
			padding-right: 1rch;
		}
	}

	td {
		font-family: var(--font-sans);
		font-variant-numeric: tabular-nums;

		&:not(:has(img)) {
			min-width: 3rch;
		}
	}

	[data-substituted] + tr th:first-child :global(img) {
		margin-left: 1lh;
	}
</style>
