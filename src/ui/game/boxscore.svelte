<script lang="ts">
	import { currentUrl, setViewParam } from '#lib/url.svelte.js'
	import { cn } from '#lib/utils.js'
	import DataTable from '#ui/data-table/data-table.svelte'
	import type { CellArgs, DataTableColumn } from '#ui/data-table/types.js'
	import Empty from '#ui/empty.svelte'
	import { favoritesStore } from '#ui/favorites/store.svelte.js'
	import BoxscorePlayer from '#ui/game/boxscore-player.svelte'
	import BullpenFatigue from '#ui/game/bullpen-fatigue.svelte'
	import Scorecard from '#ui/game/scorecard.svelte'
	import PillSwitcher from '#ui/pill-switcher.svelte'
	import ToggleSpoilerPrevention from '#ui/spoiler-prevention/toggle-spoiler-prevention.svelte'
	import StyledTeam from '#ui/team/styled-team.svelte'
	import type { HTMLAttributes } from 'svelte/elements'

	let {
		boxscore,
		gameDate,
		players,
		plays,
		scheduledInnings,
		isFinal,
		isSpoilerPrevented,
		onAtBatSelect,
		class: className,
	}: {
		boxscore?: MLB.Boxscore | null
		gameDate?: string
		players?: Record<string, MLB.Person> | null
		/** `liveData.plays.allPlays`, for the scorecard */
		plays?: MLB.Play[]
		scheduledInnings?: number
		isFinal?: boolean
		isSpoilerPrevented?: boolean
		/** A scorecard cell was clicked: show that plate appearance in the pitch sequence */
		onAtBatSelect?: (atBatIndex: number) => void
	} & HTMLAttributes<HTMLDivElement> = $props()

	let { away, home } = $derived(
		boxscore?.teams ?? {
			away: undefined,
			home: undefined,
		},
	)

	const VIEWS = [
		{ id: 'boxscore', label: 'Boxscore' },
		{ id: 'scorecard', label: 'Scorecard' },
	] as const

	type View = (typeof VIEWS)[number]['id']

	/** One player's line: game and season stats, and where they fit in the batting order */
	type Line = {
		player: MLB.BoxscorePlayer
		group: 'batting' | 'pitching' | 'roster'
		/** Came in for the batter above */
		substitute?: boolean
	}

	/** Sorted away from the batting order, where a substitute's indent would point at the wrong player */
	const isSorted = (group: Line['group']) =>
		group !== 'roster' && !!currentUrl().searchParams.get(group)

	function battersOf(team: MLB.TeamBoxscore): Line[] {
		return team.batters.flatMap((playerId, i) => {
			const player = team.players[`ID${playerId}`]
			if (!player || player.position?.abbreviation === 'P') return []

			const previous = team.batters
				.slice(0, i)
				.findLast((id) => team.players[`ID${id}`]?.position?.abbreviation !== 'P')

			return [
				{
					player,
					group: 'batting' as const,
					substitute:
						!isSpoilerPrevented && previous !== undefined && !team.battingOrder.includes(previous),
				},
			]
		})
	}

	function pitchersOf(team: MLB.TeamBoxscore): Line[] {
		return team.pitchers
			.slice(0, isSpoilerPrevented ? 1 : team.pitchers.length)
			.flatMap((playerId) => {
				const player = team.players[`ID${playerId}`]
				return player && (player.position?.abbreviation === 'P' || !!player.stats?.pitching)
					? [{ player, group: 'pitching' as const }]
					: []
			})
	}

	function rosterOf(team: MLB.TeamBoxscore, ids: number[]): Line[] {
		return ids.flatMap((id) => {
			const player = team.players[`ID${id}`]
			return player ? [{ player, group: 'roster' as const }] : []
		})
	}

	const isFavorite = (row: Line) => favoritesStore.has(`/player/${row.player.person.id}`)

	const playerColumn: DataTableColumn<Line> = {
		id: 'player',
		header: '',
		title: 'Player',
		// batting order, or the stat being sorted, says more than the alphabet
		sortable: false,
		sticky: true,
		rowHeader: true,
		cell: playerCell,
		cellClass: (row) => isFavorite(row) && 'bg-accent! text-dark',
		// the name alone was 14ch; this cell also holds the headshot and position
		class: 'min-w-[17ch] pl-[1rch]',
	}

	/**
	 * A game stat: blank while spoilers are hidden, faded at zero. `'0.0'` innings still counts as
	 * an appearance, so it isn't faded.
	 */
	function statColumn(
		group: 'batting' | 'pitching',
		id: string,
		header: string,
		title: string,
		season?: boolean,
	): DataTableColumn<Line> {
		const read = (row: Line) =>
			(
				(season ? row.player.seasonStats : row.player.stats)?.[group] as
					Record<string, string | number | undefined> | undefined
			)?.[id]

		return {
			id: `${season ? 'season-' : ''}${id}`,
			header,
			title: `${title}${season ? ' (season)' : ''}`,
			value: (row) => (isSpoilerPrevented ? undefined : read(row)),
			numeric: true,
			format: (value) => (isSpoilerPrevented ? '' : String(value ?? '')),
			cellClass: (row) => {
				const value = read(row)
				return [
					'font-sans',
					season && 'min-w-[5ch] text-sm',
					!isSpoilerPrevented && value !== '0.0' && Number(value) === 0 && 'text-current/40',
					id === 'avg' && Number(value) >= 0.3 && 'positive',
					id === 'ops' && Number(value) >= 0.75 && 'positive',
				]
			},
			class: 'min-w-[3rch] px-[.25ch] text-center last:pr-[1rch]',
		}
	}

	const battingColumns: DataTableColumn<Line>[] = [
		playerColumn,
		statColumn('batting', 'atBats', 'AB', 'At bats'),
		statColumn('batting', 'hits', 'H', 'Hits'),
		statColumn('batting', 'runs', 'R', 'Runs'),
		statColumn('batting', 'rbi', 'RBI', 'Runs batted in'),
		statColumn('batting', 'homeRuns', 'HR', 'Home runs'),
		statColumn('batting', 'baseOnBalls', 'BB', 'Walks'),
		statColumn('batting', 'strikeOuts', 'K', 'Strikeouts'),
		statColumn('batting', 'stolenBases', 'SB', 'Stolen bases'),
		statColumn('batting', 'avg', 'AVG', 'Batting average', true),
		statColumn('batting', 'ops', 'OPS', 'On-base plus slugging', true),
	]

	const pitchingColumns: DataTableColumn<Line>[] = [
		playerColumn,
		statColumn('pitching', 'inningsPitched', 'IP', 'Innings pitched'),
		statColumn('pitching', 'numberOfPitches', 'P', 'Pitches'),
		statColumn('pitching', 'balls', 'B', 'Balls'),
		statColumn('pitching', 'strikes', 'S', 'Strikes'),
		statColumn('pitching', 'hits', 'H', 'Hits allowed'),
		statColumn('pitching', 'runs', 'R', 'Runs allowed'),
		statColumn('pitching', 'earnedRuns', 'ER', 'Earned runs'),
		statColumn('pitching', 'homeRuns', 'HR', 'Home runs allowed'),
		statColumn('pitching', 'baseOnBalls', 'BB', 'Walks'),
		statColumn('pitching', 'strikeOuts', 'K', 'Strikeouts'),
		statColumn('pitching', 'hitBatsmen', 'HBP', 'Hit batters'),
		statColumn('pitching', 'era', 'ERA', 'Earned run average', true),
	]

	const rosterColumns: DataTableColumn<Line>[] = [{ ...playerColumn, sticky: false }]

	/** Kept in `?view=` so a shared link opens the same tab. */
	const view = $derived<View>(
		currentUrl().searchParams.get('view') === 'scorecard' ? 'scorecard' : 'boxscore',
	)
</script>

<div id="boxscore" class={cn('min-w-0', className)}>
	{#if away?.batters.length || home?.batters.length}
		<PillSwitcher
			id="boxscore"
			aria-label="Lineup view"
			class="mb-[.5lh]"
			options={VIEWS}
			value={view}
			controls="boxscore-lineup-away boxscore-lineup-home"
			onchange={(next) => setViewParam('view', next, 'boxscore')}
		/>
	{/if}

	<article
		class="grid snap-x snap-mandatory auto-cols-[min(var(--container-sm),calc(100vw-2ch))] grid-flow-col overflow-x-auto sm:grid-cols-2 sm:px-ch"
	>
		{@render team(away, 'away')}
		{@render team(home, 'home')}
	</article>
</div>

{#snippet team(team: MLB.TeamBoxscore | undefined, side: 'away' | 'home')}
	{#if team}
		<article class="snap-center bg-background">
			<StyledTeam team={team.team} class="z-1 pr-ch">
				<ToggleSpoilerPrevention
					class="ml-auto shrink-0 text-current! transition-opacity not-hover:opacity-50"
					team={{ id: team.team.id, abbreviation: team.team.abbreviation! }}
				/>
			</StyledTeam>

			{#if team.batters.length}
				{@const batters = battersOf(team)}
				<div id="boxscore-lineup-{side}" role="tabpanel" aria-labelledby="boxscore-tab-{view}">
					{#if view === 'scorecard'}
						<Scorecard
							{team}
							{side}
							{plays}
							{scheduledInnings}
							{isFinal}
							{isSpoilerPrevented}
							{onAtBatSelect}
							{players}
						/>
					{:else}
						<DataTable
							label="{team.team.name} batting"
							data={batters}
							columns={battingColumns}
							getRowId={(row) => String(row.player.person.id)}
							sortable={!isSpoilerPrevented}
							sortParam="batting"
							tableClass="w-full"
							stickyHeader={false}
						/>
					{/if}
				</div>

				<hr class="my-[.5ch] border-dashed border-current/25" />

				<DataTable
					label="{team.team.name} pitching"
					data={pitchersOf(team)}
					columns={pitchingColumns}
					getRowId={(row) => String(row.player.person.id)}
					sortable={!isSpoilerPrevented}
					sortParam="pitching"
					tableClass="w-full"
					stickyHeader={false}
				/>

				{#if gameDate && !isSpoilerPrevented}
					<hr class="my-[.5ch] border-dashed border-current/25" />
					<!-- One anchor for the section navigator, on the away side since it comes first -->
					<BullpenFatigue {team} {gameDate} id={side === 'away' ? 'bullpen-fatigue' : undefined} />
				{/if}
			{:else if team.bench?.length || team.bullpen?.length}
				{#if team.bench?.length}
					<DataTable
						label="{team.team.name} bench"
						data={rosterOf(team, team.bench)}
						columns={rosterColumns}
						getRowId={(row) => String(row.player.person.id)}
						sortable={false}
						stickyHeader={false}
						hideHeader
					/>
				{/if}

				{#if team.bench?.length && team.bullpen?.length}
					<hr class="my-[.5ch] border-dashed border-current/25" />
				{/if}

				{#if team.bullpen?.length}
					<DataTable
						label="{team.team.name} bullpen"
						data={rosterOf(team, team.bullpen)}
						columns={rosterColumns}
						getRowId={(row) => String(row.player.person.id)}
						sortable={false}
						stickyHeader={false}
						hideHeader
					/>
				{/if}
			{:else}
				<Empty>No boxscore data</Empty>
			{/if}
		</article>
	{/if}
{/snippet}

{#snippet playerCell({ row }: CellArgs<Line>)}
	<BoxscorePlayer
		player={row.player}
		{players}
		substitute={row.substitute && !isSorted(row.group)}
	/>
{/snippet}
