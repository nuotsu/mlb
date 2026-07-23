<script lang="ts">
	import { cn } from '$lib/utils'
	import StyledTeam from '$ui/team/styled-team.svelte'

	let {
		game,
		boxscore,
		linescore,
		absChallenges,
		absChallengeTeamId,
		isSpoilerPrevented,
	}: {
		game: MLB.Game
		boxscore: MLB.Boxscore
		linescore?: MLB.Linescore
		absChallenges?: MLB.AbsChallenges
		absChallengeTeamId?: number
		isSpoilerPrevented?: boolean
	} = $props()

	const isLive = $derived(game.status.abstractGameState === 'Live')
	const showAbsChallenges = $derived(!!absChallenges)
</script>

{#if ['Final', 'Live'].includes(game.status.abstractGameState) && !isSpoilerPrevented}
	<div class="grid text-left *:pl-[.25ch]">
		{#each ['away', 'home'] as const as teamKey (teamKey)}
			{@const team = boxscore.teams[teamKey].team}
			{@const awayActive = teamKey === 'away' && linescore?.inningState === 'Top'}
			{@const homeActive = teamKey === 'home' && linescore?.inningState === 'Bottom'}
			{@const remaining = absChallenges?.[teamKey]?.remaining ?? 0}
			{@const challenging = absChallengeTeamId === team.id}
			{@const isActive = isLive && (awayActive || homeActive)}

			<div class="flex items-center gap-[.25ch]">
				{#if showAbsChallenges}
					<span
						class={cn(
							'inline-flex shrink-0 flex-col items-center justify-center gap-[.15lh]',
							challenging && 'animate-pulse',
						)}
						aria-label="{remaining} ABS challenge{remaining === 1 ? '' : 's'} remaining"
					>
						{#each [0, 1] as i (i)}
							<span
								class={cn(
									'block size-[.15lh]',
									i < remaining ? 'bg-tmobile' : 'bg-current/25',
								)}
							></span>
						{/each}
					</span>
				{/if}

				<StyledTeam
					class="min-w-0 grow bg-background"
					team={team}
					record={game.teams[teamKey].leagueRecord}
					linked
				>
					<strong class="ml-auto shrink-0 pr-[.5ch] text-right tabular-nums">
						{#if isLive}
							{linescore?.teams?.[teamKey]?.runs}
						{:else}
							{game.teams[teamKey].score}
						{/if}
					</strong>

					{#if isActive}
						<span class="absolute inset-y-0 left-full w-[.3ch] animate-pulse bg-accent"></span>
					{/if}
				</StyledTeam>
			</div>
		{/each}
	</div>
{:else}
	<div class="grid grid-cols-2 bg-background text-center">
		<StyledTeam
			class="flex-row-reverse pl-ch *:data-name:order-last [&_picture]:ml-auto"
			team={boxscore.teams.away.team}
			record={game.teams.away.leagueRecord}
			linked
		/>
		<StyledTeam
			class="pr-ch *:data-name:order-last [&_picture]:mr-auto"
			team={boxscore.teams.home.team}
			record={game.teams.home.leagueRecord}
			linked
		/>
	</div>
{/if}
