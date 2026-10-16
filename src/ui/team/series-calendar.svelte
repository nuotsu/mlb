<script lang="ts">
	import { fetchTeamSeasonSchedule } from '#lib/fetch/presets.js'
	import { teamColor } from '#lib/team-colors.js'
	import { formatDate } from '#lib/temporal.js'
	import { cn } from '#lib/utils.js'
	import Divider from '#ui/divider.svelte'
	import Empty from '#ui/empty.svelte'
	import { ChevronLeftIcon, ChevronRightIcon } from '#ui/icons/index.js'
	import Loading from '#ui/loading.svelte'
	import Headshot from '#ui/player/headshot.svelte'
	import { spoilerPreventionStore } from '#ui/spoiler-prevention/store.svelte.js'
	import { browser } from '$app/env'
	import Logo from './logo.svelte'
	import {
		groupSeries,
		monthWeeks,
		predictStarters,
		seasonMonths,
		toTeamGames,
		weekSegments,
		type TeamGame,
		type TeamSeries,
	} from './series'

	let {
		team,
		season,
		date,
		class: className,
	}: {
		team: MLB.TeamDetailed
		season: number
		/** The page's as-of day (YYYY-MM-DD); the calendar opens on its month */
		date: string
		class?: string
	} = $props()

	const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

	type CalendarData = {
		series: TeamSeries[]
		months: string[]
		gamesByDate: Map<string, TeamGame[]>
	}

	const cache = new Map<string, Promise<CalendarData>>()

	async function buildCalendar(teamId: number, year: number): Promise<CalendarData> {
		const schedule = await fetchTeamSeasonSchedule(teamId, year, {
			sportId: String(team.sport?.id ?? 1),
			hydrate: 'team,probablePitcher',
			fields: [
				'dates,date',
				'games,gamePk,gameDate,gameType,description',
				'status,abstractGameState,detailedState,startTimeTBD',
				'teams,home,away,team,id,name,clubName,teamName,abbreviation,isWinner,score',
				'probablePitcher,fullName',
			],
		})

		const games = predictStarters(toTeamGames(schedule, teamId))

		const gamesByDate = new Map<string, TeamGame[]>()
		for (const game of games) {
			gamesByDate.set(game.date, [...(gamesByDate.get(game.date) ?? []), game])
		}

		return { series: groupSeries(games), months: seasonMonths(games), gamesByDate }
	}

	function fetchCalendar(teamId: number, year: number) {
		const key = `${teamId}-${year}`
		if (!cache.has(key)) cache.set(key, buildCalendar(teamId, year))
		return cache.get(key)!
	}

	/** Follows the page's date; the arrows move it from there */
	let month = $derived(date.slice(0, 7))

	/** The selected month, held inside the months the team played */
	function clampMonth(months: string[]) {
		if (month < months[0]) return months[0]
		if (month > months.at(-1)!) return months.at(-1)!
		return month
	}

	const hideSpoilers = $derived(spoilerPreventionStore.has(team.id))

	function result(game: TeamGame) {
		switch (game.state) {
			case 'postponed':
				return 'PPD'
			case 'cancelled':
				return 'CXL'
			case 'suspended':
				return 'SUSP'
			case 'preview':
				return game.startTimeTBD
					? 'TBD'
					: formatDate(game.gameDate, { hour: 'numeric', minute: '2-digit' })
		}

		if (hideSpoilers || game.teamScore == null || game.opponentScore == null) {
			return game.state === 'live' ? 'Live' : 'Final'
		}

		const score = `${game.teamScore}-${game.opponentScore}`
		if (game.state === 'live') return score
		return `${game.didWin === true ? 'W' : game.didWin === false ? 'L' : 'T'} ${score}`
	}

	function title(game: TeamGame) {
		return [
			`${game.isHome ? 'vs' : '@'} ${game.opponent.name}`,
			game.gameType !== 'R' && game.description,
			result(game),
			game.pitcher && `SP: ${game.pitcher.fullName}${game.predicted ? ' (predicted)' : ''}`,
		]
			.filter(Boolean)
			.join(' · ')
	}
</script>

<Divider>Series Calendar</Divider>

{#snippet loading()}
	<Loading class="justify-center p-lh text-current/40">Loading series calendar...</Loading>
{/snippet}

<div class={cn('px-ch', className)}>
	{#if browser}
		{#await fetchCalendar(team.id, season)}
			{@render loading()}
		{:then { series, months, gamesByDate }}
			{#if !months.length}
				<Empty>No games in {season}</Empty>
			{:else}
				{@const shown = clampMonth(months)}
				{@const index = months.indexOf(shown)}

				<fieldset class="flex justify-center gap-px text-center">
					<button
						type="button"
						class={cn(
							'order-first button border-b-0 border-l',
							index <= 0 && 'pointer-events-none opacity-50',
						)}
						aria-label="Previous month"
						onclick={() => (month = months[index - 1] ?? shown)}
					>
						<ChevronLeftIcon />
					</button>

					<select
						class="button min-w-[16ch] text-center"
						aria-label="Month"
						value={shown}
						onchange={(e) => (month = e.currentTarget.value)}
					>
						{#each months as m (m)}
							<option value={m}>{formatDate(`${m}-01`, { month: 'long', year: 'numeric' })}</option>
						{/each}
					</select>

					<button
						type="button"
						class={cn(
							'order-last button border-r border-b-0',
							index >= months.length - 1 && 'pointer-events-none opacity-50',
						)}
						aria-label="Next month"
						onclick={() => (month = months[index + 1] ?? shown)}
					>
						<ChevronRightIcon />
					</button>
				</fieldset>

				<div class="mt-ch grid gap-y-[.5ch]">
					<div class="grid grid-cols-7 text-center text-sm text-current/40">
						{#each DOW as d (d)}
							<span>{d}</span>
						{/each}
					</div>

					{#each monthWeeks(shown) as week, wi (`${shown}-${wi}`)}
						<div class="grid grid-cols-7">
							<!-- One band per series, behind the days it spans -->
							{#each weekSegments(week, series) as segment (segment.series.startDate + segment.series.opponent.id)}
								<div
									class={cn(
										'band row-start-1 mt-4 rounded-t-sm',
										!segment.continuesBefore && 'ml-px border-l-2',
										!segment.continuesAfter && 'mr-px border-r-2',
										segment.continuesBefore && 'rounded-tl-none',
										segment.continuesAfter && 'rounded-tr-none',
									)}
									style:grid-column="{segment.column} / span {segment.span}"
									style:--band={teamColor(segment.series.opponent.id)}
								></div>
							{/each}

							{#each week as day, di (di)}
								<div
									class="row-start-1 grid min-w-0 content-start justify-items-center pb-px text-center"
									style:grid-column={di + 1}
								>
									{#if day}
										{@const games = gamesByDate.get(day)}

										<a
											class={cn(
												'h-4 px-[.5ch] text-xs leading-4 tabular-nums hover-link',
												day === date ? 'bg-accent text-dark' : !games && 'text-current/40',
											)}
											href="/schedule/day/{day}"
										>
											{Number(day.slice(-2))}
										</a>

										{#each games ?? [] as game (game.gamePk)}
											<a
												class="grid w-full justify-items-center gap-px py-[.25ch] leading-none hover:bg-current/10"
												href="/game/{game.gamePk}"
												title={title(game)}
											>
												<span class="flex items-center gap-[.25ch]">
													<small class="text-[length:xx-small] text-current/60">
														{game.isHome ? 'vs' : '@'}
													</small>

													<Logo class="size-[1.25rem] object-contain" team={game.opponent} />

													{#if game.pitcher}
														<Headshot
															class={cn(
																'size-[1.25rem] shrink-0 max-lg:hidden',
																game.predicted && 'opacity-50',
															)}
															person={game.pitcher}
															size={72}
														/>
													{/if}
												</span>

												<small
													class={cn(
														'text-[length:xx-small] whitespace-nowrap tabular-nums sm:text-xs',
														game.state !== 'final' && game.state !== 'live' && 'text-current/60',
														!hideSpoilers && game.didWin === true && 'positive',
														!hideSpoilers && game.didWin === false && 'negative',
														game.state === 'live' && 'font-bold',
													)}
												>
													{result(game)}
												</small>
											</a>
										{/each}
									{/if}
								</div>
							{/each}
						</div>
					{/each}
				</div>
			{/if}
		{:catch}
			<Empty>Failed to load series calendar</Empty>
		{/await}
	{:else}
		{@render loading()}
	{/if}
</div>

<style>
	.band {
		--band-edge: color-mix(in oklab, var(--band) 75%, var(--color-foreground));

		border-top: 2px solid var(--band-edge);
		border-inline-color: var(--band-edge);
		background: linear-gradient(
			color-mix(in oklab, var(--band) 20%, transparent),
			color-mix(in oklab, var(--band) 4%, transparent)
		);
	}
</style>
