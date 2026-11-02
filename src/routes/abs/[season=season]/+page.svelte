<script lang="ts">
	import {
		ABS_FIRST_SEASON,
		type AbsChallenger,
		type AbsChallengerType,
	} from '#lib/fetch/savant.js'
	import { cn } from '#lib/utils.js'
	import PlayerCell from '#ui/data-table/cells/player-cell.svelte'
	import DataTable from '#ui/data-table/data-table.svelte'
	import type { CellArgs, DataTableColumn, HeaderArgs } from '#ui/data-table/types.js'
	import Empty from '#ui/empty.svelte'
	import { favoritesStore } from '#ui/favorites/store.svelte.js'
	import Header from '#ui/header.svelte'
	import { SearchIcon } from '#ui/icons/index.js'
	import Metadata from '#ui/metadata.svelte'
	import SelectGameType from '#ui/select-game-type.svelte'
	import SelectSeason from '#ui/stats/select-season.svelte'
	import Logo from '#ui/team/logo.svelte'
	import { goto, replaceState } from '$app/navigation'
	import { page } from '$app/state'
	import type { PageProps } from './$types'

	let { data }: PageProps = $props()

	type Format = 'count' | 'rate' | 'signed'

	type Column = {
		key: string
		short: string
		full: string
		value: (row: AbsChallenger) => number | string | undefined
		format?: Format
		/** Direction of the first click. Numbers rank highest first, names A–Z. */
		first?: 'asc' | 'desc'
		/** Color the value by sign, for stats measured against an average challenger. */
		toned?: boolean
		/** Savant doesn't always send it; hidden when no row has a value. */
		optional?: boolean
		/** Shown without a header button, e.g. the team logos the team filter already covers. */
		unsortable?: boolean
	}

	const COLUMNS: Column[] = [
		{
			key: 'player',
			short: 'Player',
			full: 'Player',
			value: (row) => row.player.fullName,
			first: 'asc',
		},
		{
			key: 'team',
			short: 'Team',
			full: 'Team',
			value: (row) => row.team?.abbreviation,
			unsortable: true,
		},
		{
			key: 'challenges',
			short: 'Chal',
			full: 'Challenges',
			value: (row) => row.challenges,
			format: 'count',
		},
		{
			key: 'overturns',
			short: 'W',
			full: 'Overturned (challenge won)',
			value: (row) => row.overturns,
			format: 'count',
		},
		{
			key: 'fails',
			short: 'L',
			full: 'Upheld (challenge lost)',
			value: (row) => row.fails,
			format: 'count',
		},
		{
			key: 'overturnRate',
			short: 'Win%',
			full: 'Share of challenges overturned',
			value: (row) => row.overturnRate,
			format: 'rate',
		},
		{
			key: 'expectedOverturnRate',
			optional: true,
			short: 'xWin%',
			full: 'Expected overturn rate for an average challenger on the same pitches',
			value: (row) => row.expectedOverturnRate,
			format: 'rate',
		},
		{
			key: 'overturnsVsExpected',
			optional: true,
			short: '+/-',
			full: 'Overturns above expected',
			value: (row) => row.overturnsVsExpected,
			format: 'signed',
			toned: true,
		},
		{
			key: 'runs',
			optional: true,
			short: 'RV',
			full: 'Run value gained from challenges',
			value: (row) => row.runs,
			format: 'signed',
		},
		{
			key: 'runsVsExpected',
			optional: true,
			short: 'RV+/-',
			full: 'Run value above expected',
			value: (row) => row.runsVsExpected,
			format: 'signed',
			toned: true,
		},
		{
			key: 'challengeRate',
			optional: true,
			short: 'Chal%',
			full: 'Share of challenge opportunities taken',
			value: (row) => row.challengeRate,
			format: 'rate',
		},
	]

	const TYPES: { value: AbsChallengerType; label: string }[] = [
		{ value: 'batter', label: 'Batters' },
		{ value: 'catcher', label: 'Catchers' },
		{ value: 'pitcher', label: 'Pitchers' },
	]

	const MIN_OPTIONS = [1, 5, 10, 20, 30, 50]

	const gameType = $derived(page.url.searchParams.get('gameType') ?? 'R')

	/** Small samples flood the rate columns with 1-for-1s, so full seasons start with a floor. */
	const defaultMin = $derived(gameType === 'R' ? 10 : 1)

	// Sorting happens in the browser, so these mirror the URL rather than derive from it.
	let sortKey = $state(page.url.searchParams.get('sort') ?? 'overturnRate')
	let sortDir = $state<'asc' | 'desc'>(page.url.searchParams.get('dir') === 'asc' ? 'asc' : 'desc')
	let min = $state(Number(page.url.searchParams.get('min')) || 0)
	let teamId = $state(page.url.searchParams.get('team') ?? '')
	let search = $state(page.url.searchParams.get('q') ?? '')

	const minChallenges = $derived(min || defaultMin)

	/** Hide columns Savant didn't send, rather than fill them with dashes. */
	const columns = $derived(
		COLUMNS.filter(
			(column) => !column.optional || data.challengers.some((row) => column.value(row) != null),
		),
	)

	const sortColumn = $derived(
		columns.find((c) => c.key === sortKey) ?? columns.find((c) => c.key === 'overturnRate')!,
	)

	/** Only the clubs with a challenger in this table. */
	const teams = $derived(
		[
			...new Map(
				data.challengers.flatMap((row) => (row.team ? [[row.team.id, row.team]] : [])),
			).values(),
		].toSorted((a, b) => a.name.localeCompare(b.name)),
	)

	const team = $derived(teams.find((t) => String(t.id) === teamId))

	const onTeam = $derived(
		team ? data.challengers.filter((row) => row.team?.id === team.id) : data.challengers,
	)

	/** Totals for the whole league, or the filtered team, regardless of the minimum. */
	const totals = $derived.by(() => {
		const challenges = onTeam.reduce((sum, row) => sum + row.challenges, 0)
		const overturns = onTeam.reduce((sum, row) => sum + row.overturns, 0)
		return { challenges, overturns, rate: challenges ? overturns / challenges : 0 }
	})

	/**
	 * Above the minimum, in tiebreak order: the table sorts by the chosen column and keeps this
	 * order among ties (most challenges, then A–Z). Missing values sink either way.
	 */
	const rows = $derived(
		onTeam
			.filter((row) => row.challenges >= minChallenges)
			.toSorted(
				(a, b) =>
					b.challenges - a.challenges ||
					(a.player.fullName ?? '').localeCompare(b.player.fullName ?? ''),
			),
	)

	/** Fold accents so `Jose Ramirez` finds `José Ramírez`. */
	const fold = (text = '') =>
		text
			.normalize('NFD')
			.replace(/\p{Diacritic}/gu, '')
			.toLowerCase()

	/** Each word of the search, in any order, so `ramirez jose` works too. */
	const terms = $derived(fold(search).split(/\s+/).filter(Boolean))

	const period = $derived(
		gameType === 'P'
			? `${page.params.season} Postseason`
			: gameType === 'S'
				? `${page.params.season} Spring Training`
				: page.params.season,
	)

	const typeLabel = $derived(TYPES.find((t) => t.value === data.challengerType)?.label ?? 'Batters')

	/** The current URL plus this page's client-side state, with defaults left out. */
	function href(overrides: Record<string, string> = {}) {
		const url = new URL(page.url.href)
		const params = {
			type: data.challengerType,
			sort: sortKey,
			dir: sortDir,
			min: min ? String(min) : '',
			team: teamId,
			q: search.trim(),
			...overrides,
		}

		const defaults: Record<string, string> = { type: 'batter', sort: 'overturnRate', dir: 'desc' }

		for (const [key, value] of Object.entries(params)) {
			if (!value || defaults[key] === value) url.searchParams.delete(key)
			else url.searchParams.set(key, value)
		}

		return url.pathname + url.search
	}

	const isFavorite = (row: AbsChallenger) =>
		!!row.player.id && favoritesStore.has(`/player/${row.player.id}`)

	/** Searching hides rows without renumbering the rankings. */
	const matchesSearch = (row: AbsChallenger) => {
		const name = fold(row.player.fullName)
		return terms.every((term) => name.includes(term))
	}

	const tableColumns = $derived<DataTableColumn<AbsChallenger>[]>([
		{
			id: 'rank',
			header: '#',
			title: 'Rank',
			sortable: false,
			align: 'right',
			cell: rankCell,
			class: 'w-[4ch]',
		},
		...columns.map((column): DataTableColumn<AbsChallenger> => {
			if (column.key === 'player')
				return {
					id: 'player',
					header: playerHeader,
					title: column.full,
					value: column.value,
					sortDescFirst: false,
					sticky: true,
					rowHeader: true,
					cell: playerCell,
					// the favorite highlight wins over team colors
					team: (row) => (isFavorite(row) ? undefined : { team: row.team }),
					class: 'w-[22ch] min-w-[22ch]',
				}

			if (column.key === 'team')
				return {
					id: 'team',
					header: '',
					title: column.full,
					sortable: false,
					align: 'center',
					cell: teamCell,
					team: (row) => (isFavorite(row) ? undefined : { team: row.team }),
				}

			return {
				id: column.key,
				header: column.short,
				title: column.full,
				value: column.value,
				numeric: true,
				sortDescFirst: (column.first ?? 'desc') === 'desc',
				format: (value) => format(value ?? undefined, column.format),
				cellClass: (_, value) => tone(column, value ?? undefined),
			}
		}),
	])

	function format(value: number | string | undefined, kind?: Format) {
		if (value == null || value === '') return '-'
		if (typeof value === 'string') return value

		switch (kind) {
			case 'rate':
				return (value * 100).toFixed(1)
			case 'signed':
				return `${value > 0 ? '+' : ''}${value.toFixed(1)}`
			default:
				return value.toLocaleString()
		}
	}

	function tone(column: Column, value: number | string | undefined) {
		if (!column.toned || typeof value !== 'number' || Math.abs(value) < 0.05) return undefined
		return value > 0 ? 'positive' : 'negative'
	}
</script>

<Metadata
	title="{period} ABS Challenge Rankings | MLB.TheOhtani.com"
	description="Which MLB {typeLabel.toLowerCase()} win the most ABS ball/strike challenges in {period}: challenges, overturns, win rate, and run value"
/>

<Header
	title="ABS Challenges"
	crumbs={[
		{ href: '/abs', name: 'ABS Challenges' },
		{ href: page.url.pathname + page.url.search, name: typeLabel },
	]}
>
	{#snippet after()}
		<div class="mx-auto flex flex-wrap items-center justify-center gap-ch text-center">
			<nav class="flex items-center gap-px" aria-label="Challenger">
				{#each TYPES as { value, label } (value)}
					<a
						class={cn(
							'button',
							data.challengerType === value &&
								'border-accent font-bold text-green-700 dark:text-accent',
						)}
						href={href({ type: value })}
						aria-current={data.challengerType === value ? 'page' : undefined}
					>
						{label}
					</a>
				{/each}
			</nav>

			<SelectGameType class="button text-center" />

			<SelectSeason
				onchange={(e) =>
					goto(`/abs/${(e.currentTarget as HTMLSelectElement).value}${page.url.search}`)}
			/>

			<label class="flex items-center gap-[.5ch] text-sm">
				<span class="text-current/50">Min</span>
				<select
					class="button text-center"
					value={minChallenges}
					onchange={(e) => {
						const value = Number((e.currentTarget as HTMLSelectElement).value)
						min = value === defaultMin ? 0 : value
						replaceState(href(), page.state)
					}}
				>
					{#each MIN_OPTIONS as option (option)}
						<option value={option}>{option} chal</option>
					{/each}
				</select>
			</label>

			<select
				class="button text-center"
				aria-label="Team"
				value={team ? teamId : ''}
				onchange={(e) => {
					teamId = (e.currentTarget as HTMLSelectElement).value
					replaceState(href(), page.state)
				}}
			>
				<option value="">All teams</option>
				{#each teams as { id, name } (id)}
					<option value={String(id)}>{name}</option>
				{/each}
			</select>
		</div>
	{/snippet}
</Header>

<section class="space-y-ch pt-lh md:px-ch">
	<h2 class="px-ch text-sm text-current/50">
		{team ? `${team.name} ` : ''}{typeLabel} — {period}
		{#if totals.challenges}
			<span class="tabular-nums">
				· {totals.overturns.toLocaleString()} of {totals.challenges.toLocaleString()} overturned ({format(
					totals.rate,
					'rate',
				)}%)
			</span>
		{/if}
	</h2>

	<!-- Past 50 challengers only the rows in view are rendered -->
	<DataTable
		label="{typeLabel} ABS challenges, {period}"
		data={rows}
		columns={tableColumns}
		getRowId={(row) => String(row.player.id ?? row.player.fullName)}
		sorting={[{ id: sortColumn.key, desc: sortDir === 'desc' }]}
		onSortingChange={([next]) => {
			if (!next) return
			sortKey = next.id
			sortDir = next.desc ? 'desc' : 'asc'
			replaceState(href(), page.state)
		}}
		enableSortingRemoval={false}
		filter={matchesSearch}
		rowClass={(row) => isFavorite(row) && 'text-dark *:bg-accent'}
	>
		{#snippet empty()}
			<Empty>
				{#if Number(page.params.season) < ABS_FIRST_SEASON}
					ABS challenges came to MLB in {ABS_FIRST_SEASON}
				{:else if data.unavailable}
					Couldn't load ABS challenges from Baseball Savant
				{:else if rows.length}
					No {typeLabel.toLowerCase()} matching “{search.trim()}”
				{:else if data.challengers.length}
					No {team ? `${team.name} ` : ''}{typeLabel.toLowerCase()} with {minChallenges}+ challenges
				{:else}
					No ABS challenges yet
				{/if}
			</Empty>
		{/snippet}
	</DataTable>

	<p class="px-ch pt-ch pb-lh text-xs text-current/40">
		Data from
		<a
			class="underline decoration-dashed"
			href="https://baseballsavant.mlb.com/leaderboard/abs-challenges"
		>
			Baseball Savant
		</a>. Type in Player to search; click a column to sort, and again to flip highest/lowest.
	</p>
</section>

{#snippet rankCell({ index }: CellArgs<AbsChallenger>)}
	<span class="text-xs text-current/50">{index + 1}</span>
{/snippet}

{#snippet playerHeader({ sorted, toggle }: HeaderArgs)}
	<div class="flex items-stretch gap-[.5ch] text-foreground">
		<label class="grid grow *:col-span-full *:row-span-full">
			<SearchIcon class="pointer-events-none z-1 mx-[.5ch] my-auto size-[1em] text-current/40" />

			<input
				class="input w-full min-w-0 pr-[.5ch] pl-[calc(1em+1ch)] font-normal"
				type="search"
				placeholder="Player"
				aria-label="Search players"
				bind:value={
					() => search,
					(value) => {
						search = value
						replaceState(href(), page.state)
					}
				}
			/>
		</label>

		<button
			type="button"
			class={cn(
				'min-w-8 px-[.5ch] text-[x-small]',
				sorted ? 'bg-foreground text-background' : 'text-current/40',
			)}
			title="Sort players {sorted === 'asc' ? 'Z–A' : 'A–Z'}"
			onclick={toggle}
		>
			{sorted === 'desc' ? '▼' : '▲'}
		</button>
	</div>
{/snippet}

{#snippet playerCell({ row }: CellArgs<AbsChallenger>)}
	<PlayerCell
		person={row.player}
		type="silo"
		name={row.player.fullName}
		title={undefined}
		class={cn(isFavorite(row) && 'text-dark')}
	/>
{/snippet}

{#snippet teamCell({ row: { team } }: CellArgs<AbsChallenger>)}
	{#if team}
		<a class="flex justify-center" href="/teams/{team.id}" title={team.name}>
			<Logo class="size-lh shrink-0" {team} loading="lazy" decoding="async" />
		</a>
	{:else}
		-
	{/if}
{/snippet}
