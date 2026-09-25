<script lang="ts">
	import { goto } from '$app/navigation'
	import { page } from '$app/state'
	import { isDarkOnLightTeam, isLightOnDarkTeam } from '$lib/colors'
	import { byRecord, byWildCardRank, isDivisionLeader, leagueSide } from '$lib/postseason/bracket'
	import { formatDate } from '$lib/temporal'
	import { cn } from '$lib/utils'
	import Empty from '$ui/empty.svelte'
	import Header from '$ui/header.svelte'
	import { ArrowUpIcon, TrophyIcon } from '$ui/icons'
	import Metadata from '$ui/metadata.svelte'
	import SelectGameType from '$ui/select-game-type.svelte'
	import SelectSport from '$ui/select-sport.svelte'
	import SelectSeason from '$ui/stats/select-season.svelte'
	import StyledTeam from '$ui/team/styled-team.svelte'
	import type { PageProps } from './$types'

	let { data }: PageProps = $props()

	const since = $derived(formatDate(data.comparisonDate, { month: 'short', day: 'numeric' }))

	type StandingsRecord = (typeof data.standings.records)[number]

	type Table = {
		title: string
		teamRecords: MLB.TeamRecord[]
		/** Which games-back figure the table measures against. */
		gamesBack: 'gamesBack' | 'leagueGamesBack' | 'wildCardGamesBack' | 'sportGamesBack'
		/** Postseason seed of the table's first team, for tables that show seeds. */
		firstSeed?: number
		/** Rows above this index hold a postseason spot; a line is drawn beneath them. */
		cutAfter?: number
		/** Adds an AL/NL column, for tables that mix both leagues. */
		showLeague?: boolean
	}

	/** Team ID to `'AL'`/`'NL'`; team records don't carry their league, only the record around them. */
	const teamLeagues = $derived(
		new Map(
			data.standings.records.flatMap(({ league, teamRecords }) =>
				teamRecords.map(({ team }) => [team.id, leagueSide(league?.id)] as const),
			),
		),
	)

	const leagueGroups = $derived(
		Object.values(Object.groupBy(data.standings.records, (record) => record.league?.id ?? 0)).map(
			(records = []) => ({
				key: records[0]?.league?.id ?? 0,
				heading: records[0]?.league?.name,
				records,
			}),
		),
	)

	const groups = $derived.by((): { key: number; heading?: string; tables: Table[] }[] => {
		if (data.view === 'mlb') {
			const teamRecords = data.standings.records
				.flatMap(({ teamRecords }) => teamRecords)
				.sort(
					(a, b) =>
						(Number(a.sportRank) || Infinity) - (Number(b.sportRank) || Infinity) || byRecord(a, b),
				)

			return teamRecords.length
				? [
						{
							key: 0,
							tables: [
								{ title: 'MLB', teamRecords, gamesBack: 'sportGamesBack', showLeague: true },
							],
						},
					]
				: []
		}

		if (data.view === 'playoff') {
			return leagueGroups.map(({ key, heading, records }) => {
				const teamRecords = records.flatMap(({ teamRecords }) => teamRecords)
				const leaders = teamRecords.filter(isDivisionLeader).sort(byRecord)
				const others = teamRecords.filter((r) => !isDivisionLeader(r)).sort(byWildCardRank)

				// 2020's expanded field took every division's runner-up ahead of the wild cards.
				const wildCards =
					page.params.season === '2020'
						? [
								...others.filter((r) => r.divisionRank === '2').sort(byRecord),
								...others.filter((r) => r.divisionRank !== '2'),
							]
						: others

				return {
					key,
					heading,
					tables: [
						{
							title: 'Division Leaders',
							teamRecords: leaders,
							gamesBack: 'leagueGamesBack',
							firstSeed: 1,
						},
						...(data.wildCardSpots
							? [
									{
										title: 'Wild Card',
										teamRecords: wildCards,
										gamesBack: 'wildCardGamesBack',
										firstSeed: leaders.length + 1,
										cutAfter: data.wildCardSpots,
									} satisfies Table,
								]
							: []),
					],
				}
			})
		}

		return leagueGroups.map(({ key, heading, records }) => ({
			key,
			heading,
			tables: removeDuplicates(records.sort(sortOrder)).map(({ division, teamRecords }) => ({
				title: division?.nameShort ?? '',
				teamRecords,
				gamesBack: 'gamesBack',
			})),
		}))
	})

	// Magic and elimination numbers only exist for the regular season.
	const showMagicNumber = $derived(data.standingsType === 'regularSeason')

	/**
	 * The magic number for the team in front, and its mirror image — the number of games until
	 * elimination — for everyone chasing. MLB sends these as strings that can also be `'-'` (not
	 * yet meaningful) or `'E'` (eliminated), and only fills in `magicNumber` for the leader.
	 *
	 * `eliminationNumber` only covers the division race, and by September most of a division is
	 * out of that while still chasing a wild card. A team is only shown as eliminated once it's
	 * out of both races; until then it shows the number for whichever race it's still alive in.
	 */
	function magicNumber({
		magicNumber,
		eliminationNumber,
		wildCardEliminationNumber,
		clinched,
	}: MLB.TeamRecord) {
		// Before `clinched`, so a team that has locked up a wild card but is still chasing the
		// division keeps showing that race's number.
		if (isNumeric(magicNumber))
			return { text: magicNumber, title: `${magicNumber} to clinch the division`, tone: 'positive' }

		if (clinched) return { text: '✓', title: 'Clinched a playoff spot', tone: 'positive' }

		if (isNumeric(eliminationNumber))
			return {
				text: eliminationNumber,
				title: `${eliminationNumber} from elimination in the division race`,
				tone: 'negative',
			}

		if (eliminationNumber !== 'E') return null

		if (isNumeric(wildCardEliminationNumber))
			return {
				text: wildCardEliminationNumber,
				title: `Out of the division race; ${wildCardEliminationNumber} from wild card elimination`,
				tone: 'negative',
			}

		// Seasons without a wild card never send `wildCardEliminationNumber`, so being out of the
		// division race is the whole story there. `'-'` means the wild card race is still open.
		if (wildCardEliminationNumber === 'E' || wildCardEliminationNumber == null)
			return { text: 'E', title: 'Eliminated from postseason contention', tone: 'negative' }

		return null
	}

	/** MLB's standings numbers are strings; `'-'` and `'E'` aren't numbers. */
	function isNumeric(value: string | undefined): value is string {
		return value !== undefined && value !== '' && !isNaN(Number(value))
	}

	function sortOrder(a: StandingsRecord, b: StandingsRecord) {
		return (a.division?.sortOrder ?? 0) - (b.division?.sortOrder ?? 0)
	}

	function removeDuplicates(records: StandingsRecord[]) {
		const seen = new Set<number>()
		return records.filter((record) => {
			const id = record.division?.id
			if (id === undefined) return true
			if (seen.has(id)) return false
			seen.add(id)
			return true
		})
	}
</script>

<svelte:head>
	{@html `<script type="application/ld+json">${JSON.stringify({
		'@context': 'https://schema.org',
		'@type': 'ItemList',
		name: `${page.params.season} MLB Standings`,
		url: `https://mlb.theohtani.com/standings/${page.params.season}`,
		itemListElement: data.standings.records.flatMap(({ division, teamRecords }) =>
			teamRecords.map(({ team, wins, losses, winningPercentage, leagueRank, sportRank }) => ({
				'@type': 'ListItem',
				position: Number(data.view === 'mlb' ? sportRank : leagueRank),
				name: `${team.name} (${wins}-${losses}, ${winningPercentage})`,
				item: {
					'@type': 'SportsTeam',
					name: team.name,
					url: `https://mlb.theohtani.com/teams/${team.id}`,
					description: `${division?.nameShort ?? 'MLB'} | ${wins}-${losses} | ${winningPercentage}`,
				},
			})),
		),
	})}<\/script>`}
</svelte:head>

<Metadata
	title="{page.params.season} MLB Standings | MLB.TheOhtani.com"
	description="MLB standings for the {page.params.season} season"
/>

<Header title="Standings" crumbs={[{ name: 'Standings' }]}>
	{#snippet after()}
		<div class="mx-auto flex flex-wrap items-center justify-center gap-ch text-center">
			<div class="flex items-center gap-px">
				<SelectSport available={data.availableSportIds} />
				<SelectGameType
					class="button text-center"
					available={data.availableGameTypes}
					options={[{ value: 'MLB', label: 'MLB' }]}
				/>
			</div>
			{#if page.url.searchParams.get('gameType') === 'P'}
				<a class="button flex items-center gap-[.5ch]" href="/postseason/{page.params.season}">
					<TrophyIcon class="size-[1em]" />
					Bracket
				</a>
			{/if}
			<SelectSeason
				onchange={(e) =>
					goto(`/standings/${(e.currentTarget as HTMLSelectElement).value}${page.url.search}`)}
			/>
		</div>
	{/snippet}
</Header>

<section class="grid gap-lh p-ch">
	{#each groups as { key, heading, tables } (key)}
		<div class="flex flex-col gap-ch">
			{#if heading}
				<h2 class="px-ch text-sm text-current/50">{heading}</h2>
			{/if}
			<div class="grid items-start gap-[2lh]">
				{#each tables as { title, teamRecords, gamesBack: gamesBackKey, firstSeed, cutAfter, showLeague }, i (i)}
					<div class="overflow-x-auto overflow-y-hidden">
						<table class="w-max min-w-full text-center">
							<thead>
								<tr class="text-sm text-current/50 *:font-normal">
									<!--
										Once there's room for it, the team column is pinned to 24ch: a percentage
										width keeps the table's slack away from it, so the stat columns take that
										space instead of the name stretching across the row.
									-->
									<th
										class="sticky left-0 z-1 min-w-[10ch] bg-background text-left text-foreground md:w-[1%] md:min-w-[24ch]"
									>
										<span class="line-clamp-1 break-all">{title}</span>
									</th>
									{#if showLeague}
										<th class="w-[5ch]">Lg</th>
									{/if}
									<th class="w-[8ch]">W-L</th>
									<th class="w-[5ch]">%</th>
									<th class="w-[5ch]">{gamesBackKey === 'wildCardGamesBack' ? 'WCGB' : 'GB'}</th>
									<th class="w-[5ch]">Strk</th>
									{#if showMagicNumber}
										<th class="w-[6ch]">Magic</th>
									{/if}
									<th class="w-[6ch]">Rank</th>
									<th class="w-[8ch]">↑/↓</th>
								</tr>
							</thead>
							<tbody>
								{#each teamRecords as record, row (record.team.id)}
									{@const { team, wins, losses, winningPercentage, streak } = record}
									{@const gamesBack = record[gamesBackKey] ?? '-'}
									{@const rank = data.view === 'mlb' ? record.sportRank : record.leagueRank}
									{@const change = data.rankChanges[team.id]}
									{@const magic = magicNumber(record)}
									{@const seed =
										firstSeed && (cutAfter === undefined || row < cutAfter)
											? firstSeed + row
											: undefined}
									<tr
										class={cn(
											'hover:[&>td]:bg-foreground/10',
											row === (cutAfter ?? 0) - 1 &&
												row < teamRecords.length - 1 &&
												'[&>td]:border-b-2 [&>td]:border-dashed [&>td]:border-current/50',
										)}
									>
										<td
											class={cn(
												'sticky left-0 z-1 min-w-[10ch] bg-background md:w-[1%] md:min-w-[24ch]',
												{
													'dark:text-dark': isDarkOnLightTeam(team),
													'dark:text-light': isLightOnDarkTeam(team),
												},
											)}
										>
											<div class="flex items-center gap-ch">
												{#if firstSeed}
													<span
														class="w-[2ch] shrink-0 text-right text-sm text-current/50 tabular-nums"
														title={seed ? `No. ${seed} seed` : undefined}
													>
														{seed ?? ''}
													</span>
												{/if}
												<StyledTeam class="min-w-0 flex-1 text-left" {team} linked />
											</div>
										</td>
										{#if showLeague}
											<td class="text-current/50">{teamLeagues.get(team.id) ?? '-'}</td>
										{/if}
										<td class="flex justify-center tabular-nums">
											<span class="positive">{wins}</span>
											-
											<span class="negative">{losses}</span>
										</td>
										<td
											class={cn(
												'tabular-nums',
												Number(winningPercentage) >= 0.5 ? 'positive' : 'negative',
											)}
										>
											{winningPercentage}
										</td>
										<td
											class={cn(
												'tabular-nums',
												(gamesBack === '0' || gamesBack === '-') && 'text-current/50',
												gamesBack.startsWith('+') && 'positive',
											)}
										>
											{gamesBack === '0' ? '-' : gamesBack}
										</td>
										<td
											class="tabular-nums"
											class:positive={streak?.streakCode?.startsWith('W')}
											class:negative={streak?.streakCode?.startsWith('L')}
										>
											{streak?.streakCode}
										</td>
										{#if showMagicNumber}
											<td class={cn('tabular-nums', magic?.tone)}>
												{#if magic}
													<span title={magic.title}>{magic.text}</span>
												{:else}
													<span class="text-current/50">-</span>
												{/if}
											</td>
										{/if}
										<td class="tabular-nums">{rank}</td>
										<td
											class="tabular-nums"
											class:positive={change > 0}
											class:negative={change < 0}
										>
											{#if change}
												<span
													class="inline-flex items-center gap-[.25ch]"
													title="{change > 0 ? 'Up' : 'Down'} {Math.abs(change)} since {since}"
												>
													<ArrowUpIcon
														class={cn('size-[.85em]', change < 0 && 'rotate-180')}
														role="img"
														aria-label={change > 0 ? 'Up' : 'Down'}
													/>
													{Math.abs(change)}
												</span>
											{:else}
												<span class="text-current/50">-</span>
											{/if}
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/each}
			</div>
		</div>
	{:else}
		<Empty>No standings</Empty>
	{/each}
</section>
