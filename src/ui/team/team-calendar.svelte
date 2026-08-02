<script lang="ts">
	import { isDarkOnLightTeam, isLightOnDarkTeam } from '$lib/colors'
	import { fetchMLB } from '$lib/fetch'
	import { cn } from '$lib/utils'
	import Headshot from '$ui/player/headshot.svelte'
	import Calendar from '$ui/schedule/calendar.svelte'
	import StyledTeam from './styled-team.svelte'

	let {
		team,
		class: className,
	}: {
		team: MLB.TeamDetailed
		class?: string
	} = $props()

	// Memoize per-year so the schedule + rotation is only built once
	const scheduleCache = new Map<number, Promise<ScheduleData>>()

	type ScheduleData = {
		gamesByDate: Record<string, MLB.Game[]>
		/** gamePk → predicted pitcher for upcoming unconfirmed games */
		predictions: Map<number, MLB.Person>
		/** gamePk → confirmed pitcher for past games */
		confirmedPast: Map<number, MLB.Person>
	}

	function extractRotation(pitchers: MLB.Person[]): MLB.Person[] {
		const rotation: MLB.Person[] = []
		const seen = new Set<number>()
		for (const p of pitchers) {
			if (seen.has(p.id)) break
			seen.add(p.id)
			rotation.push(p)
		}
		return rotation.length >= 3 ? rotation : pitchers.slice(-7)
	}

	async function fetchProbablePitcher(gamePk: number): Promise<MLB.Person | null> {
		try {
			const feed = await fetchMLB<MLB.LiveGameFeed>(`/api/v1.1/game/${gamePk}/feed/live`, {
				fields: ['gameData,probablePitchers', 'away,home,id,fullName', 'teams,name,sport'],
			})
			const isHome = feed.gameData.teams.home.id === team.id
			return feed.gameData.probablePitchers?.[isHome ? 'home' : 'away'] ?? null
		} catch {
			return null
		}
	}

	async function buildScheduleData(year: number): Promise<ScheduleData> {
		const schedule = await fetchMLB<MLB.ScheduleResponse>(`/api/v1/schedule`, {
			sportId: String(team.sport?.id ?? 1),
			teamId: String(team.id),
			season: String(year),
			fields: [
				'dates,date',
				'games,gamePk,gameDate',
				'status,abstractGameState',
				'teams,home,away,team,id,name,clubName,teamName,abbreviation,isWinner',
				'sport',
			],
			hydrate: 'team',
		})

		const gamesByDate: Record<string, MLB.Game[]> = Object.fromEntries(
			(schedule?.dates ?? []).map(({ date, games }) => [date, games]),
		)

		// All games sorted chronologically
		const allGames = (schedule?.dates ?? [])
			.flatMap(({ games }) => games)
			.sort((a, b) => a.gameDate.localeCompare(b.gameDate))

		// Fetch pitchers for the last 7 completed games (rotation) + next 10 upcoming
		// games (to sync confirmed pitchers into the rotation before predicting)
		const pastGames = allGames.filter((g) => g.status.abstractGameState === 'Final').slice(-7)
		const upcomingGames = allGames.filter((g) => g.status.abstractGameState === 'Preview').slice(0, 10)

		const fetchResults = await Promise.all(
			[...pastGames, ...upcomingGames].map(
				async (g) => [g.gamePk, await fetchProbablePitcher(g.gamePk)] as const,
			),
		)
		const fetched = new Map<number, MLB.Person>(
			fetchResults.filter((r): r is [number, MLB.Person] => r[1] !== null),
		)

		const confirmedPast = new Map<number, MLB.Person>(
			pastGames.filter((g) => fetched.has(g.gamePk)).map((g) => [g.gamePk, fetched.get(g.gamePk)!]),
		)

		// Build the rotation from confirmed past pitchers in order
		const pastPitcherList = pastGames.map((g) => fetched.get(g.gamePk)).filter((p): p is MLB.Person => !!p)
		const rotation = extractRotation(pastPitcherList)
		const lastConfirmed = pastPitcherList.at(-1)
		let rotationPos =
			lastConfirmed && rotation.length >= 2
				? rotation.findIndex((p) => p.id === lastConfirmed.id)
				: -1

		// Walk through all Preview games in order. When a confirmed pitcher is found
		// (from the pre-fetched upcoming window), sync rotationPos to their slot so
		// that subsequent predictions continue from the right place.
		const predictions = new Map<number, MLB.Person>()
		if (rotationPos !== -1 && rotation.length >= 2) {
			for (const g of allGames) {
				if (g.status.abstractGameState !== 'Preview') continue
				const confirmed = fetched.get(g.gamePk)
				if (confirmed) {
					const pos = rotation.findIndex((p) => p.id === confirmed.id)
					if (pos !== -1) rotationPos = pos
				} else {
					rotationPos = (rotationPos + 1) % rotation.length
					predictions.set(g.gamePk, rotation[rotationPos])
				}
			}
		}

		return { gamesByDate, predictions, confirmedPast }
	}

	function fetchSchedule(year: number): Promise<ScheduleData> {
		if (!scheduleCache.has(year)) scheduleCache.set(year, buildScheduleData(year))
		return scheduleCache.get(year)!
	}
</script>

<Calendar class={className} {cells} />

{#snippet cells({ day, year, month }: { day: number | null; year: number; month: number })}
	{#if day}
		{@const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`}

		{#await fetchSchedule(year) then { gamesByDate, predictions, confirmedPast }}
			{#if gamesByDate[date]}
				<ul class="grid gap-px">
					{#each gamesByDate[date] as game (game.gamePk)}
						{@const { gamePk, teams } = game}
						{@const isHome = teams.home.team.id === team.id}
						{@const opponent = isHome ? teams.away.team : teams.home.team}
						{@const isPreview = game.status.abstractGameState === 'Preview'}
						{@const didWin = isHome ? teams.home.isWinner : teams.away.isWinner}

						<li>
							<a href="/game/{gamePk}">
								<StyledTeam
									class="justify-center gap-0 overflow-clip text-foreground *:data-name:hidden @max-[10ch]/team:[&:has([src*=silo])_picture>img]:size-[.75lh]"
									team={opponent}
								>
									{#if confirmedPast.has(gamePk)}
										<!-- Past game with a confirmed probable pitcher -->
										<Headshot
											person={confirmedPast.get(gamePk)!}
											class="order-first -ml-px size-lh shrink-0"
											size={72}
											type="silo"
											title={confirmedPast.get(gamePk)!.fullName}
										/>
									{:else if isPreview}
										<!-- Upcoming game: fetch confirmed pitcher, fall back to prediction -->
										{#await fetchProbablePitcher(gamePk) then confirmed}
											{@const pitcher = confirmed ?? predictions.get(gamePk) ?? null}
											{#if pitcher}
												<Headshot
													person={pitcher}
													class={cn(
														'order-first -ml-px size-lh shrink-0',
														!confirmed && 'opacity-50',
													)}
													size={72}
													type="silo"
													title={pitcher.fullName}
												/>
											{/if}
										{/await}
									{:else}
										<!-- Older completed games — fetch on demand -->
										{#await fetchProbablePitcher(gamePk) then person}
											{#if person}
												<Headshot
													{person}
													class="order-first -ml-px size-lh shrink-0"
													size={72}
													type="silo"
													title={person.fullName}
												/>
											{/if}
										{/await}
									{/if}

									<small
										class={cn(
											'order-first @max-[10ch]/team:text-[xx-small]',
											isDarkOnLightTeam(opponent) && 'dark:text-dark',
											isLightOnDarkTeam(opponent) && 'dark:text-light',
											didWin === true && 'positive!',
											didWin === false && 'negative!',
										)}
									>
										{isHome ? 'vs' : '@'}
									</small>
								</StyledTeam>
							</a>
						</li>
					{/each}
				</ul>
			{/if}
		{/await}
	{/if}
{/snippet}
