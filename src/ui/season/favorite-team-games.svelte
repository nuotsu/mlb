<script lang="ts">
	import { browser } from '$app/environment'
	import { fetchMLB } from '$lib/fetch'
	import { formatDate, getToday } from '$lib/temporal'
	import { cn } from '$lib/utils'
	import { favoritesStore } from '$ui/favorites/store.svelte'
	import { spoilerPreventionStore } from '$ui/spoiler-prevention/store.svelte'
	import StyledTeam from '$ui/team/styled-team.svelte'

	type FavoriteTeamGames = {
		team: MLB.TeamDetailed
		games: (MLB.Game & { linescore?: MLB.Linescore })[]
	}

	const teamIds = $derived(
		favoritesStore.favorites
			.filter((f) => f.href.includes('team'))
			.map((f) => f.href.split('/').pop())
			.filter((id): id is string => !!id),
	)

	const today = $derived(formatDate(getToday(), { locale: 'en-CA' }))

	// Memoize per team + date so `{#await}` doesn't refetch on every re-render
	const cache = new Map<string, Promise<FavoriteTeamGames>>()

	async function buildFavoriteTeamGames(teamId: string, date: string): Promise<FavoriteTeamGames> {
		const {
			teams: [team],
		} = await fetchMLB<{ teams: MLB.TeamDetailed[] }>(`/api/v1/teams/${teamId}`, {
			fields: ['teams,id,name,clubName,teamName,abbreviation,sport'],
		})

		// `sportId` comes from the team so non-MLB favorites resolve too
		const schedule = await fetchMLB<MLB.ScheduleResponse>('/api/v1/schedule', {
			sportId: String(team?.sport?.id ?? 1),
			teamId,
			date,
			fields: [
				'dates,games,gamePk,gameDate',
				'status,abstractGameState,detailedState,reason',
				'teams,home,away,team,id,name,clubName,teamName,abbreviation,score,isWinner',
				'linescore,currentInning,inningState,scheduledInnings',
			],
			hydrate: 'team,linescore',
		})

		return { team, games: (schedule?.dates ?? []).flatMap(({ games }) => games) }
	}

	function fetchFavoriteTeamGames(teamId: string, date: string) {
		const key = `${teamId}-${date}`
		if (!cache.has(key)) cache.set(key, buildFavoriteTeamGames(teamId, date))
		return cache.get(key)!
	}
</script>

<!-- Bare `dt`/`dd` pairs so they land as direct grid items of the parent `description-list` -->
{#if browser}
	{#each teamIds as teamId (teamId)}
		{#await fetchFavoriteTeamGames(teamId, today) then { team, games }}
			{#each games as game (game.gamePk)}
				{@const isHome = game.teams.home.team.id === team.id}
				{@const side = isHome ? game.teams.home : game.teams.away}
				{@const opponent = (isHome ? game.teams.away : game.teams.home).team}
				{@const linescore = game.linescore}
				{@const isSpoilerPrevented =
					spoilerPreventionStore.has(game.teams.away.team.id) ||
					spoilerPreventionStore.has(game.teams.home.team.id)}
				{@const state = isSpoilerPrevented ? 'Preview' : game.status.abstractGameState}
				{@const isExtras =
					!!linescore?.currentInning &&
					!!linescore?.scheduledInnings &&
					linescore.currentInning > linescore.scheduledInnings}

				<dt class="line-clamp-1">{team.clubName ?? team.name}</dt>
				<dd>
					<a
						href="/game/{game.gamePk}"
						class="inline-flex max-w-max items-center gap-[.5ch] hover-link"
					>
						<small class="text-xs">{isHome ? 'vs' : '@'}</small>

						<StyledTeam class="w-[20ch]" team={opponent} />

						{#if state === 'Preview'}
							<time class="text-sm whitespace-nowrap" datetime={game.gameDate}>
								{formatDate(game.gameDate, { hour: 'numeric', minute: '2-digit' })}
							</time>
						{:else}
							<span
								class={cn(
									'tabular-nums',
									state === 'Final' && side.isWinner === true && 'positive',
									state === 'Final' && side.isWinner === false && 'negative',
								)}
							>
								<span class={cn(!isHome && 'font-bold')}>{game.teams.away.score ?? 0}</span>-<span
									class={cn(isHome && 'font-bold')}>{game.teams.home.score ?? 0}</span
								>
							</span>

							<small class="text-xs whitespace-nowrap">
								{#if state === 'Live'}
									{linescore?.inningState?.slice(0, 3)}
									{linescore?.currentInning}
								{:else}
									{game.status.reason ||
										game.status.detailedState}{#if isExtras}/{linescore?.currentInning}{/if}
								{/if}
							</small>
						{/if}
					</a>
				</dd>
			{/each}
		{/await}
	{/each}
{/if}
