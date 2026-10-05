<script lang="ts">
	import {
		ABS_FIRST_SEASON,
		type AbsChallenger,
		type AbsChallengerType,
	} from '#lib/fetch/savant.js'
	import { cn } from '#lib/utils.js'
	import Empty from '#ui/empty.svelte'
	import { favoritesStore } from '#ui/favorites/store.svelte.js'
	import Header from '#ui/header.svelte'
	import Metadata from '#ui/metadata.svelte'
	import Headshot from '#ui/player/headshot.svelte'
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
			first: 'asc',
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

	const league = $derived.by(() => {
		const challenges = data.challengers.reduce((sum, row) => sum + row.challenges, 0)
		const overturns = data.challengers.reduce((sum, row) => sum + row.overturns, 0)
		return { challenges, overturns, rate: challenges ? overturns / challenges : 0 }
	})

	const rows = $derived.by(() => {
		const direction = sortDir === 'asc' ? 1 : -1
		const { value } = sortColumn

		return data.challengers
			.filter((row) => row.challenges >= minChallenges)
			.toSorted((a, b) => {
				const [x, y] = [value(a), value(b)]

				// Missing values sink regardless of direction.
				if (x == null || y == null) return x == null ? (y == null ? 0 : 1) : -1

				const order =
					typeof x === 'string' || typeof y === 'string'
						? String(x).localeCompare(String(y))
						: x - y

				return (
					order * direction ||
					b.challenges - a.challenges ||
					(a.player.fullName ?? '').localeCompare(b.player.fullName ?? '')
				)
			})
	})

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
			...overrides,
		}

		const defaults: Record<string, string> = { type: 'batter', sort: 'overturnRate', dir: 'desc' }

		for (const [key, value] of Object.entries(params)) {
			if (!value || defaults[key] === value) url.searchParams.delete(key)
			else url.searchParams.set(key, value)
		}

		return url.pathname + url.search
	}

	function sortBy(column: Column) {
		if (sortKey === column.key) {
			sortDir = sortDir === 'desc' ? 'asc' : 'desc'
		} else {
			sortKey = column.key
			sortDir = column.first ?? 'desc'
		}

		replaceState(href(), page.state)
	}

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
						class={cn('button', data.challengerType === value && 'bg-foreground text-background')}
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
		</div>
	{/snippet}
</Header>

<section class="space-y-ch py-lh md:px-ch">
	<h2 class="px-ch text-sm text-current/50">
		{typeLabel} — {period}
		{#if league.challenges}
			<span class="tabular-nums">
				· {league.overturns.toLocaleString()} of {league.challenges.toLocaleString()} overturned ({format(
					league.rate,
					'rate',
				)}%)
			</span>
		{/if}
	</h2>

	<div class="overflow-x-auto overflow-y-hidden">
		<table class="w-max min-w-full text-center">
			<thead class="text-sm">
				<tr>
					<th class="w-[4ch] text-right text-xs text-current/40" scope="col">#</th>

					{#each columns as column (column.key)}
						{@const active = sortColumn.key === column.key}

						<th
							class={cn(
								'px-[.5ch]',
								column.key === 'player' &&
									'sticky left-0 z-1 min-w-[18ch] bg-background text-left md:min-w-[26ch]',
								column.key === 'team' && 'text-left',
							)}
							scope="col"
							aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined}
						>
							<button
								type="button"
								class={cn(
									'flex w-full items-center gap-[.5ch] whitespace-nowrap',
									column.format ? 'justify-center' : 'justify-start',
									active ? 'bg-foreground font-bold text-background' : 'text-current/40',
								)}
								title="{column.full} — sort {active && sortDir === 'desc'
									? 'lowest'
									: 'highest'} first"
								onclick={() => sortBy(column)}
							>
								{column.short}
								<span class={cn('text-[x-small]', !active && 'invisible')} aria-hidden="true">
									{sortDir === 'asc' ? '▲' : '▼'}
								</span>
							</button>
						</th>
					{/each}
				</tr>
			</thead>

			<tbody>
				{#each rows as row, i (row.player.id ?? row.player.fullName)}
					{@const favorite = row.player.id && favoritesStore.has(`/player/${row.player.id}`)}

					<tr class={cn('hover:[&>td]:bg-foreground/10', favorite && 'text-dark [&>td]:bg-accent')}>
						<td class="text-right text-xs text-current/50 tabular-nums">{i + 1}</td>

						{#each columns as column (column.key)}
							{@const value = column.value(row)}

							{#if column.key === 'player'}
								<th
									class={cn(
										'sticky left-0 z-1 min-w-[18ch] bg-background text-left font-normal md:min-w-[26ch]',
										favorite && 'bg-accent',
									)}
									scope="row"
								>
									<div class="group/player relative flex items-center gap-ch">
										<Headshot person={row.player} class="size-lh shrink-0" />

										{#if row.player.id}
											<a
												class="line-clamp-1 break-all decoration-dashed group-hover/player:underline"
												href="/player/{row.player.id}"
											>
												{row.player.fullName}
												<span class="absolute inset-0"></span>
											</a>
										{:else}
											<span class="line-clamp-1 break-all">{row.player.fullName}</span>
										{/if}
									</div>
								</th>
							{:else if column.key === 'team'}
								<td class="text-left">
									{#if row.team}
										<a
											class="flex items-center gap-[.5ch] decoration-dashed hover:underline"
											href="/teams/{row.team.id}"
											title={row.team.name}
										>
											<Logo class="size-lh shrink-0" team={row.team} />
											{row.team.abbreviation}
										</a>
									{:else}
										-
									{/if}
								</td>
							{:else}
								<td
									class={cn(
										'tabular-nums',
										sortColumn.key === column.key && 'font-bold',
										tone(column, value),
									)}
								>
									{format(value, column.format)}
								</td>
							{/if}
						{/each}
					</tr>
				{:else}
					<tr>
						<td colspan={columns.length + 1}>
							<Empty>
								{#if Number(page.params.season) < ABS_FIRST_SEASON}
									ABS challenges came to MLB in {ABS_FIRST_SEASON}
								{:else if data.unavailable}
									Couldn't load ABS challenges from Baseball Savant
								{:else if data.challengers.length}
									No {typeLabel.toLowerCase()} with {minChallenges}+ challenges
								{:else}
									No ABS challenges yet
								{/if}
							</Empty>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<p class="px-ch text-xs text-current/40">
		Data from
		<a
			class="underline decoration-dashed"
			href="https://baseballsavant.mlb.com/leaderboard/abs-challenges"
		>
			Baseball Savant
		</a>. Click a column to sort; click again to flip highest/lowest.
	</p>
</section>

<style>
	td {
		padding-inline: 1ch;
		min-width: 4ch;
	}
</style>
