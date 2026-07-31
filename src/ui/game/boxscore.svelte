<script lang="ts">
	import { cn } from '$lib/utils'
	import Empty from '$ui/empty.svelte'
	import { favoritesStore } from '$ui/favorites/store.svelte'
	import BullpenFatigue from '$ui/game/bullpen-fatigue.svelte'
	import { ArrowDownRightIcon } from '$ui/icons'
	import Headshot from '$ui/player/headshot.svelte'
	import ToggleSpoilerPrevention from '$ui/spoiler-prevention/toggle-spoiler-prevention.svelte'
	import StyledTeam from '$ui/team/styled-team.svelte'
	import type { HTMLAttributes } from 'svelte/elements'

	let {
		boxscore,
		gameDate,
		players,
		isSpoilerPrevented,
		class: className,
	}: {
		boxscore?: MLB.Boxscore | null
		gameDate?: string
		players?: Record<string, MLB.Person> | null
		isSpoilerPrevented?: boolean
	} & HTMLAttributes<HTMLDivElement> = $props()

	let { away, home } = $derived(
		boxscore?.teams ?? {
			away: undefined,
			home: undefined,
		},
	)
</script>

<article
	class="grid snap-x snap-mandatory auto-cols-[min(var(--container-sm),calc(100vw-2ch))] grid-flow-col overflow-x-auto sm:grid-cols-2 sm:px-ch {className}"
>
	{@render team(away)}
	{@render team(home)}
</article>

{#snippet team(team?: MLB.TeamBoxscore)}
	{#if team}
		<article class="snap-center bg-background">
			<StyledTeam team={team.team} class="z-1 pr-ch">
				<ToggleSpoilerPrevention
					class="ml-auto shrink-0 text-current! transition-opacity not-hover:opacity-50"
					team={{ id: team.team.id, abbreviation: team.team.abbreviation! }}
				/>
			</StyledTeam>

			{#if team.batters.length}
				<div class="overflow-x-auto mask-r-from-[calc(100%-1.5ch)]">
					<table class="table-fixed text-center">
						<thead class="text-xs text-current/40">
							<tr class="*:pt-[.5ch]">
								<th class="w-full" colspan="2"></th>
								<th>AB</th>
								<th>H</th>
								<th>R</th>
								<th>RBI</th>
								<th>HR</th>
								<th>BB</th>
								<th>K</th>
								<th>SB</th>
								<th>AVG</th>
								<th>OPS</th>
							</tr>
						</thead>
						<tbody>
							{#each team.batters as playerId}
								{@const { stats, seasonStats, ...player } = team.players[`ID${playerId}`]}
								{@const substituted = !isSpoilerPrevented && !team.battingOrder.includes(playerId)}

								{#if player?.position?.abbreviation !== 'P'}
									<tr
										class="hover:*:not-first:bg-foreground/10"
										data-substituted={substituted ? '' : undefined}
									>
										{@render p(player, substituted)}

										<!-- game stats -->
										{#each ['atBats', 'hits', 'runs', 'rbi', 'homeRuns', 'baseOnBalls', 'strikeOuts', 'stolenBases'] as stat}
											{@const value = stats?.batting?.[stat as keyof MLB.BattingStats]}
											<td
												class={cn(!isSpoilerPrevented && Number(value) === 0 && 'text-current/40')}
											>
												{#if !isSpoilerPrevented}
													{value}
												{/if}
											</td>
										{/each}

										<!-- season stats -->
										{#each ['avg', 'ops'] as stat}
											{@const value = seasonStats?.batting?.[stat as keyof MLB.BattingStats]}
											<td
												class={cn(
													'min-w-[5ch]! text-sm',
													!isSpoilerPrevented && Number(value) === 0 && 'text-current/40',
													stat === 'avg' && Number(value) >= 0.3 && 'positive',
													stat === 'ops' && Number(value) >= 0.75 && 'positive',
												)}
											>
												{#if !isSpoilerPrevented}
													{value}
												{/if}
											</td>
										{/each}
									</tr>
								{/if}
							{/each}
						</tbody>
					</table>
				</div>

				<hr class="my-[.5ch] border-dashed border-current/25" />

				<div class="overflow-x-auto mask-r-from-[calc(100%-1.5ch)]">
					<table class="table-fixed text-center">
						<thead class="text-xs text-current/40">
							<tr>
								<th class="w-full" colspan="2"></th>
								<th>IP</th>
								<th>P</th>
								<th>H</th>
								<th>R</th>
								<th>ER</th>
								<th>HR</th>
								<th>BB</th>
								<th>K</th>
								<th>HBP</th>
								<th>ERA</th>
							</tr>
						</thead>
						<tbody>
							{#each team.pitchers.slice(0, isSpoilerPrevented ? 1 : team.pitchers.length) as playerId (playerId)}
								{@const { stats, seasonStats, ...player } = team.players[`ID${playerId}`]}
								{#if player?.position?.abbreviation === 'P' || !!stats?.pitching}
									<tr class="hover:*:bg-foreground/10">
										{@render p(player)}

										<!-- game stats -->
										{#each ['inningsPitched', 'numberOfPitches', 'hits', 'runs', 'earnedRuns', 'homeRuns', 'baseOnBalls', 'strikeOuts', 'hitBatsmen'] as stat}
											{@const value = stats?.pitching?.[stat as keyof MLB.PitchingStats]}
											<td
												class={cn(
													!isSpoilerPrevented &&
														value !== '0.0' &&
														Number(value) === 0 &&
														'text-current/40',
												)}
											>
												{#if !isSpoilerPrevented}
													{value}
												{/if}
											</td>
										{/each}

										<!-- season stats -->
										{#each ['era'] as stat}
											{@const value = seasonStats?.pitching?.[stat as keyof MLB.PitchingStats]}
											<td
												class={cn(
													'min-w-[5ch]! text-sm',
													!isSpoilerPrevented && Number(value) === 0 && 'text-current/40',
												)}
											>
												{#if !isSpoilerPrevented}
													{value}
												{/if}
											</td>
										{/each}
									</tr>
								{/if}
							{/each}
						</tbody>
					</table>
				</div>

				{#if gameDate && !isSpoilerPrevented}
					<hr class="my-[.5ch] border-dashed border-current/25" />
					<BullpenFatigue {team} {gameDate} />
				{/if}
			{:else if team.bench?.length || team.bullpen?.length}
				{#if team.bench?.length}
					<div class="overflow-x-auto">
						<table class="table-fixed text-center">
							<tbody>
								{#each team.bench as playerId}
									{@const player = team.players[`ID${playerId}`]}
									{#if player}
										<tr class="hover:*:not-first:bg-foreground/10">
											{@render p(player)}
										</tr>
									{/if}
								{/each}
							</tbody>
						</table>
					</div>
				{/if}

				{#if team.bench?.length && team.bullpen?.length}
					<hr class="my-[.5ch] border-dashed border-current/25" />
				{/if}

				{#if team.bullpen?.length}
					<div class="overflow-x-auto">
						<table class="table-fixed text-center">
							<tbody>
								{#each team.bullpen as playerId}
									{@const player = team.players[`ID${playerId}`]}
									{#if player}
										<tr class="hover:*:bg-foreground/10">
											{@render p(player)}
										</tr>
									{/if}
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			{:else}
				<Empty>No boxscore data</Empty>
			{/if}
		</article>
	{/if}
{/snippet}

{#snippet p({ position, person }: MLB.BoxscorePlayer, substituted?: boolean)}
	{@const isFavorite = favoritesStore.has(`/player/${person.id}`)}
	{@const throwSide = players?.[`ID${person.id}`]?.pitchHand?.code}
	{@const sideLabel =
		position?.abbreviation === 'P' ? (throwSide ?? position.abbreviation) : position?.abbreviation}

	<th class={cn('sticky left-0 z-1 min-w-lh', isFavorite && 'bg-accent')}>
		<a href="/player/{person.id}">
			<Headshot {person} size={72} class="size-lh" />
		</a>

		{#if substituted}
			<div class="absolute top-full left-0 grid size-lh place-content-center">
				<ArrowDownRightIcon class="size-ch text-current/40" />
			</div>
		{/if}
	</th>

	<th
		class={cn('relative w-full min-w-[14ch] pl-ch text-left', isFavorite && 'bg-accent! text-dark')}
	>
		<a
			href="/player/{person.id}"
			class="group/player flex items-center gap-[.5ch] before:absolute before:inset-0"
		>
			<span class="line-clamp-1 grow break-all decoration-dashed group-hover/player:underline">
				{person.boxscoreName}
			</span>

			<small class="w-[3ch] shrink-0 text-center text-xs text-current/40 no-underline">
				{sideLabel}
			</small>
		</a>
	</th>
{/snippet}

<style>
	table tr {
		> :first-child:not(:has(img)) {
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

	[data-substituted] + tr {
		th:global(:has(img)) {
			left: -1lh;

			:global(img) {
				margin-left: 1lh;
			}
		}

		th:not(:has(img)) {
			padding-left: calc(1lh + 1ch);
		}
	}
</style>
