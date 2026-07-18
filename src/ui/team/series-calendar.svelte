<script lang="ts">
	import { browser } from '$app/environment'
	import { fetchMLB } from '$lib/fetch'
	import { fetchSeason } from '$lib/fetch/presets'
	import { formatDate } from '$lib/temporal'
	import { cn } from '$lib/utils'
	import Divider from '$ui/divider.svelte'
	import Empty from '$ui/empty.svelte'
	import Loading from '$ui/loading.svelte'
	import { spoilerPreventionStore } from '$ui/spoiler-prevention/store.svelte'
	import StyledTeam from './styled-team.svelte'

	let {
		team,
		class: className,
	}: {
		team: MLB.TeamDetailed
		class?: string
	} = $props()

	type SeriesGame = {
		gamePk: number
		gameNumber: number | null
		awayScore: number | null
		homeScore: number | null
		didWin: boolean | undefined
	}

	type SeriesRow =
		| {
				type: 'series'
				opponent: MLB.Team
				isHome: boolean
				startDate: string
				games: SeriesGame[]
		  }
		| { type: 'all-star' }

	type SeriesCalendarData = {
		rows: SeriesRow[]
		wins: number
		losses: number
	}

	function isNonCountable(status: MLB.GameStatus) {
		const state = status.detailedState
		return (
			state === 'Postponed' ||
			state === 'Cancelled' ||
			state.startsWith('Suspended') ||
			state === 'Canceled'
		)
	}

	function buildRows(games: MLB.Game[], allStarDate?: string): SeriesCalendarData {
		const gameNumbers = new Map<number, number>()
		let count = 0
		for (const game of games) {
			if (isNonCountable(game.status) || gameNumbers.has(game.gamePk)) continue
			gameNumbers.set(game.gamePk, ++count)
		}

		const rows: Extract<SeriesRow, { type: 'series' }>[] = []
		let current: Extract<SeriesRow, { type: 'series' }> | null = null
		let wins = 0
		let losses = 0

		for (const game of games) {
			const isHome = game.teams.home.team.id === team.id
			const opponent = isHome ? game.teams.away.team : game.teams.home.team
			const startNew =
				!current ||
				game.seriesGameNumber === 1 ||
				current.opponent.id !== opponent.id ||
				current.isHome !== isHome

			if (startNew) {
				current = {
					type: 'series',
					opponent,
					isHome,
					startDate: game.officialDate || game.gameDate.slice(0, 10),
					games: [],
				}
				rows.push(current)
			}

			const nonCountable = isNonCountable(game.status)
			const teamSide = isHome ? game.teams.home : game.teams.away
			const isFinal = game.status.abstractGameState === 'Final' && !nonCountable
			const hasScore =
				!nonCountable && game.teams.away.score != null && game.teams.home.score != null
			const didWin = isFinal ? teamSide.isWinner : undefined

			if (didWin === true) wins++
			else if (didWin === false) losses++

			current.games.push({
				gamePk: game.gamePk,
				gameNumber: nonCountable ? null : (gameNumbers.get(game.gamePk) ?? null),
				awayScore: hasScore ? (game.teams.away.score ?? null) : null,
				homeScore: hasScore ? (game.teams.home.score ?? null) : null,
				didWin,
			})
		}

		if (!allStarDate) return { rows, wins, losses }

		const withBreak: SeriesRow[] = []
		let inserted = false
		for (const row of rows) {
			if (!inserted && row.startDate > allStarDate) {
				withBreak.push({ type: 'all-star' })
				inserted = true
			}
			withBreak.push(row)
		}
		return { rows: withBreak, wins, losses }
	}

	const cache = new Map<number, Promise<SeriesCalendarData>>()

	async function buildSeriesCalendar(teamId: number): Promise<SeriesCalendarData> {
		const year = new Date().getFullYear()
		const sportId = String(team.sport?.id ?? 1)

		const [schedule, season] = await Promise.all([
			fetchMLB<MLB.ScheduleResponse>(`/api/v1/schedule`, {
				sportId,
				teamId: String(teamId),
				season: String(year),
				gameType: 'R',
				fields: [
					'dates,date',
					'games,gamePk,gameDate,officialDate,seriesGameNumber',
					'status,abstractGameState,detailedState',
					'teams,home,away,team,id,name,clubName,teamName,abbreviation,isWinner,score',
				],
				hydrate: 'team',
			}),
			fetchSeason(String(year), sportId).catch(() => undefined),
		])

		const games = (schedule?.dates ?? [])
			.flatMap(({ games }) => games)
			.sort((a, b) => a.gameDate.localeCompare(b.gameDate))

		return buildRows(games, season?.allStarDate)
	}

	function fetchSeriesCalendar() {
		const teamId = team.id
		if (!cache.has(teamId)) cache.set(teamId, buildSeriesCalendar(teamId))
		return cache.get(teamId)!
	}

	const hideSpoilers = $derived(spoilerPreventionStore.has(team.id))
</script>

{#snippet fallback()}
	<Divider>Series Calendar</Divider>
	<div class={cn('px-ch', className)}>
		<Loading class="justify-center">Loading series calendar...</Loading>
	</div>
{/snippet}

{#if browser}
	{#await fetchSeriesCalendar()}
		{@render fallback()}
	{:then { rows, wins, losses }}
		<Divider>
			Series Calendar{#if !hideSpoilers}
				{' '}({wins}-{losses}){/if}
		</Divider>
		{#if rows.length === 0}
			<div class={cn('px-ch', className)}>
				<Empty>No series</Empty>
			</div>
		{:else}
			<ul class={cn('gap-x-lh px-ch *:mb-px *:break-inside-avoid md:columns-3', className)}>
				{#each rows as row, i (row.type === 'all-star' ? 'all-star' : `${row.startDate}-${row.opponent.id}-${row.isHome}-${i}`)}
					{#if row.type === 'all-star'}
						<li class="grid min-h-rlh items-center text-xs tracking-wide text-current/40">
							All-Star Break
						</li>
					{:else}
						<li class="flex items-center gap-px">
							<a
								href="/schedule/day/{row.startDate}"
								class="w-[5ch] shrink-0 text-center text-sm text-current/60 tabular-nums hover-link"
							>
								{formatDate(row.startDate, { month: 'numeric', day: 'numeric' })}
							</a>

							<StyledTeam
								class="h-lh w-[calc(1lh+3ch)] shrink-0 justify-center gap-[.5ch] overflow-hidden *:data-name:hidden"
								team={row.opponent}
								linked
							>
								<small class="order-first text-xs text-foreground dark:text-white">
									{row.isHome ? 'vs' : '@'}
								</small>
							</StyledTeam>

							<div class="grid min-w-0 flex-1 grid-cols-4 gap-px">
								{#each { length: Math.max(4, row.games.length) } as _, j (j)}
									{@const game = row.games[j]}
									{#if game}
										{@const isColored =
											!hideSpoilers && (game.didWin === true || game.didWin === false)}
										<a
											href="/game/{game.gamePk}"
											class={cn(
												'group/cell grid min-h-lh place-content-center text-center tabular-nums',
												isColored
													? game.didWin
														? 'bg-green-700 text-white'
														: 'bg-red-700 text-white'
													: 'bg-current/5',
											)}
										>
											{#if game.gameNumber != null}
												<span
													class={cn(
														'text-[length:xx-small] leading-none decoration-dashed group-hover/cell:underline',
														isColored ? 'text-white/60' : 'text-current/50',
													)}
												>
													{game.gameNumber}
												</span>
											{/if}
											{#if !hideSpoilers && game.awayScore != null && game.homeScore != null}
												<span class="text-xs leading-none">
													<span class={cn(!row.isHome && 'font-bold')}>{game.awayScore}</span>-<span
														class={cn(row.isHome && 'font-bold')}>{game.homeScore}</span
													>
												</span>
											{/if}
										</a>
									{:else}
										<span class="min-h-lh"></span>
									{/if}
								{/each}
							</div>
						</li>
					{/if}
				{/each}
			</ul>
		{/if}
	{:catch}
		<Divider>Series Calendar</Divider>
		<div class={cn('px-ch', className)}>
			<Empty>Failed to load series calendar</Empty>
		</div>
	{/await}
{:else}
	{@render fallback()}
{/if}
