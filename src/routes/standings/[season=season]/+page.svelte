<script lang="ts">
	import { isDarkOnLightTeam, isLightOnDarkTeam } from '#lib/colors.js'
	import {
		byRecord,
		byWildCardRank,
		isDivisionLeader,
		leagueSide,
	} from '#lib/postseason/bracket.js'
	import { formatDate } from '#lib/temporal.js'
	import { currentUrl, setViewParam } from '#lib/url.svelte.js'
	import { cn } from '#lib/utils.js'
	import TeamCell from '#ui/data-table/cells/team-cell.svelte'
	import DataTable from '#ui/data-table/data-table.svelte'
	import type { CellArgs, DataTableColumn, HeaderArgs } from '#ui/data-table/types.js'
	import Empty from '#ui/empty.svelte'
	import Header from '#ui/header.svelte'
	import { ArrowUpIcon, TrophyIcon } from '#ui/icons/index.js'
	import Metadata from '#ui/metadata.svelte'
	import PillSwitcher from '#ui/pill-switcher.svelte'
	import SelectGameType from '#ui/select-game-type.svelte'
	import SelectSport from '#ui/select-sport.svelte'
	import SelectSeason from '#ui/stats/select-season.svelte'
	import { goto } from '$app/navigation'
	import { page } from '$app/state'
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
		/** Labels each team AL/NL, for tables that mix both leagues. */
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
				/** "American" rather than "American League", to keep the switcher compact */
				label: records[0]?.league?.nameShort ?? records[0]?.league?.name,
				records,
			}),
		),
	)

	const groups = $derived.by(
		(): { key: number; heading?: string; label?: string; tables: Table[] }[] => {
			if (data.view === 'mlb') {
				const teamRecords = data.standings.records
					.flatMap(({ teamRecords }) => teamRecords)
					.sort(
						(a, b) =>
							(Number(a.sportRank) || Infinity) - (Number(b.sportRank) || Infinity) ||
							byRecord(a, b),
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
				return leagueGroups.map(({ key, heading, label, records }) => {
					const prefix = leagueSide(key) ? `${leagueSide(key)} ` : ''
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
						label,
						tables: [
							{
								title: `${prefix}Division Leaders`,
								teamRecords: leaders,
								gamesBack: 'leagueGamesBack',
								firstSeed: 1,
							},
							...(data.wildCardSpots
								? [
										{
											title: `${prefix}Wild Card`,
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

			return leagueGroups.map(({ key, heading, label, records }) => ({
				key,
				heading,
				label,
				tables: removeDuplicates(records.sort(sortOrder)).map(({ division, teamRecords }) => ({
					title: division?.nameShort ?? '',
					teamRecords,
					gamesBack: 'gamesBack',
				})),
			}))
		},
	)

	type Row = {
		record: MLB.TeamRecord
		gamesBack: string
		rank?: string
		change?: number
		magic: ReturnType<typeof magicNumber>
		seed?: number
		/** The table numbers its seeds, so every row keeps the seed column */
		hasSeeds: boolean
		showLeague?: boolean
	}

	/** Sorting by a column replaces standings order, and with it the cut line and its meaning. */
	const isSorted = $derived(!!currentUrl().searchParams.get('sort'))

	function rowsFor({ teamRecords, gamesBack, firstSeed, cutAfter, showLeague }: Table): Row[] {
		return teamRecords.map((record, row) => ({
			record,
			gamesBack: record[gamesBack] ?? '-',
			rank: data.view === 'mlb' ? record.sportRank : record.leagueRank,
			change: data.rankChanges[record.team.id],
			magic: magicNumber(record),
			seed: firstSeed && (cutAfter === undefined || row < cutAfter) ? firstSeed + row : undefined,
			hasSeeds: !!firstSeed,
			showLeague,
		}))
	}

	/** `'-'` and `'0'` are the leader; a `'+2.0'` wild card is two games clear. */
	function gamesBackValue(gamesBack: string) {
		if (gamesBack === '-' || gamesBack === '0') return 0
		const n = Number(gamesBack)
		return Number.isFinite(n) ? (gamesBack.startsWith('+') ? -n : n) : undefined
	}

	/** `W3` is +3, `L2` is −2. */
	function streakValue(code?: string) {
		const n = Number(code?.slice(1))
		if (!code || !Number.isFinite(n)) return undefined
		return code.startsWith('L') ? -n : n
	}

	function columnsFor(table: Table): DataTableColumn<Row>[] {
		return [
			{
				id: 'team',
				header: tableTitle,
				title: table.title,
				value: (row) => row.record.team.name,
				sortable: false,
				sticky: true,
				rowHeader: true,
				cell: teamCell,
				// Once there's room for it, the team column is pinned to 24ch: a percentage width keeps
				// the table's slack away from it, so the stat columns take that space instead
				class: 'min-w-[16ch] md:w-[1%] md:min-w-[24ch]',
			},
			{
				id: 'wl',
				header: 'W-L',
				title: 'Wins and losses',
				value: (row) => row.record.wins,
				numeric: true,
				align: 'center',
				cell: winLoss,
				class: 'w-[7ch]',
			},
			{
				id: 'pct',
				header: '%',
				title: 'Winning percentage',
				value: (row) => row.record.winningPercentage,
				numeric: true,
				cellClass: (row) => (Number(row.record.winningPercentage) >= 0.5 ? 'positive' : 'negative'),
				class: 'w-[6ch]',
			},
			{
				id: 'gb',
				header: table.gamesBack === 'wildCardGamesBack' ? 'WCGB' : 'GB',
				title: table.gamesBack === 'wildCardGamesBack' ? 'Wild card games back' : 'Games back',
				value: (row) => gamesBackValue(row.gamesBack),
				numeric: true,
				sortDescFirst: false,
				format: (_, row) => (row.gamesBack === '0' ? '-' : row.gamesBack),
				cellClass: (row) => [
					(row.gamesBack === '0' || row.gamesBack === '-') && 'text-current/50',
					row.gamesBack.startsWith('+') && 'positive',
				],
				class: 'w-[6ch]',
			},
			{
				id: 'streak',
				header: 'Strk',
				title: 'Streak',
				value: (row) => streakValue(row.record.streak?.streakCode),
				numeric: true,
				format: (_, row) => row.record.streak?.streakCode ?? '',
				cellClass: (row) => [
					row.record.streak?.streakCode?.startsWith('W') && 'positive',
					row.record.streak?.streakCode?.startsWith('L') && 'negative',
				],
				class: 'w-[6ch]',
			},
			...(showMagicNumber
				? [
						{
							id: 'magic',
							header: 'Magic',
							title: 'Magic number to clinch, or games from elimination',
							value: (row) => (row.magic?.text === '✓' ? 0 : row.magic?.text),
							numeric: true,
							sortDescFirst: false,
							cell: magicCell,
							cellClass: (row) => row.magic?.tone,
							class: 'w-[7ch]',
						} satisfies DataTableColumn<Row>,
					]
				: []),
			{
				id: 'rank',
				header: 'Rank',
				title: data.view === 'mlb' ? 'Rank in MLB' : 'Rank in the league',
				value: (row) => row.rank,
				numeric: true,
				sortDescFirst: false,
				class: 'w-[7ch]',
			},
			{
				id: 'change',
				header: '↑/↓',
				title: `Change in rank since ${since}`,
				value: (row) => row.change,
				numeric: true,
				cell: changeCell,
				cellClass: (row) => [
					(row.change ?? 0) > 0 && 'positive',
					(row.change ?? 0) < 0 && 'negative',
				],
				class: 'w-[7ch]',
			},
		]
	}

	/** `al`/`nl` for MLB's leagues, the league ID for any other sport's. */
	const leagueParam = (key: number) => leagueSide(key)?.toLowerCase() ?? String(key)

	const leagueOptions = $derived(
		groups.map(({ key, label }) => ({ id: leagueParam(key), label: label ?? '' })),
	)

	/** Kept in `?league=` so a shared link opens the same league; the first one by default. */
	const league = $derived.by(() => {
		const requested = currentUrl().searchParams.get('league')
		return leagueOptions.find(({ id }) => id === requested)?.id ?? leagueOptions[0]?.id
	})

	// One league at a time when there's more than one to switch between.
	const showSwitcher = $derived(groups.length > 1)
	const shownGroups = $derived(
		showSwitcher ? groups.filter(({ key }) => leagueParam(key) === league) : groups,
	)

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
					goto(`/standings/${(e.currentTarget as HTMLSelectElement).value}${currentUrl().search}`)}
			/>
		</div>
	{/snippet}
</Header>

<section class="grid grid-cols-1 gap-lh p-ch">
	{#if showSwitcher}
		<PillSwitcher
			id="standings-league"
			aria-label="League"
			options={leagueOptions}
			value={league}
			controls="standings-league-panel"
			onchange={(next) => setViewParam('league', next, leagueOptions[0].id)}
		/>
	{/if}

	{#each shownGroups as { key, heading, tables } (key)}
		<div
			class="flex flex-col gap-ch"
			id={showSwitcher ? 'standings-league-panel' : undefined}
			role={showSwitcher ? 'tabpanel' : undefined}
			aria-labelledby={showSwitcher ? `standings-league-tab-${league}` : undefined}
		>
			{#if heading && !showSwitcher}
				<h2 class="px-ch text-sm text-current/50">{heading}</h2>
			{/if}
			<div class={cn('grid items-start', data.view === 'playoff' ? 'gap-[.5lh]' : 'gap-[2lh]')}>
				{#each tables as table, i (i)}
					<DataTable
						label={table.title}
						data={rowsFor(table)}
						columns={columnsFor(table)}
						getRowId={(row) => String(row.record.team.id)}
						sortParam="sort"
						rowClass={(_, row, rows) =>
							// the postseason cut line only means something in standings order
							!isSorted &&
							row === (table.cutAfter ?? 0) - 1 &&
							row < rows.length - 1 &&
							'*:border-b-2 *:border-dashed *:border-b-current/50'}
					/>
				{/each}
			</div>
		</div>
	{:else}
		<Empty>No standings</Empty>
	{/each}
</section>

{#snippet tableTitle({ title }: HeaderArgs)}
	<span class="line-clamp-1 text-left break-all text-foreground">{title}</span>
{/snippet}

{#snippet teamCell({ row }: CellArgs<Row>)}
	{@const league = row.showLeague ? teamLeagues.get(row.record.team.id) : undefined}
	<TeamCell
		team={row.record.team}
		lead={row.hasSeeds ? (row.seed ?? '') : undefined}
		leadTitle={row.seed ? `No. ${row.seed} seed` : undefined}
	>
		{#if league}
			<small class="ml-auto pe-[.5ch] text-xs text-current/50">{league}</small>
		{/if}
	</TeamCell>
{/snippet}

{#snippet winLoss({ row }: CellArgs<Row>)}
	<span class="positive">{row.record.wins}</span>-<span class="negative">{row.record.losses}</span>
{/snippet}

{#snippet magicCell({ row }: CellArgs<Row>)}
	{#if row.magic}
		<span title={row.magic.title}>{row.magic.text}</span>
	{:else}
		<span class="text-current/50">-</span>
	{/if}
{/snippet}

{#snippet changeCell({ row: { change } }: CellArgs<Row>)}
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
{/snippet}
