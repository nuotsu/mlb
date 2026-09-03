<script lang="ts">
	import { browser } from '$app/environment'
	import { isDarkOnLightTeam, isLightOnDarkTeam } from '$lib/colors'
	import { fetchGameLog } from '$lib/fetch/presets'
	import { formatDate, getToday } from '$lib/temporal'
	import { cn } from '$lib/utils'
	import Empty from '$ui/empty.svelte'
	import Loading from '$ui/loading.svelte'
	import Logo from '$ui/team/logo.svelte'

	let {
		group,
		person,
		baseballStats,
	}: {
		group: 'hitting' | 'pitching'
		person: MLB.Person
		baseballStats: MLB.BaseballStat[]
	} = $props()

	const LIMIT = 20
	const season = getToday().getFullYear()

	const statKeys = {
		hitting: [
			'atBats',
			'runs',
			'hits',
			'doubles',
			'triples',
			'homeRuns',
			'rbi',
			'baseOnBalls',
			'strikeOuts',
			'stolenBases',
			'avg',
		],
		pitching: [
			'inningsPitched',
			'hits',
			'runs',
			'earnedRuns',
			'baseOnBalls',
			'strikeOuts',
			'homeRuns',
			'numberOfPitches',
			'era',
		],
	} as const

	/** Rate stats on gameLog splits are season-to-date, not single-game. */
	const runningKeys = ['avg', 'era']

	/** Current season first; fill from last season only when it comes up short. Newest first. */
	async function fetchLast20() {
		const current = await fetchGameLog(person.id, group, season)

		let splits = current
		if (current.length < LIMIT) {
			const previous = await fetchGameLog(person.id, group, season - 1).catch(() => [])
			splits = [...current, ...previous]
		}

		// Key by gamePk so doubleheaders (same date) stay distinct and overlaps collapse
		const byGame = new Map<number | string, MLB.StatSplit>()
		for (const split of splits) {
			byGame.set(split.game?.gamePk ?? `${split.date}-${split.opponent?.id}`, split)
		}

		return [...byGame.values()]
			.sort(
				(a, b) =>
					(b.date ?? '').localeCompare(a.date ?? '') ||
					(b.game?.gamePk ?? 0) - (a.game?.gamePk ?? 0),
			)
			.slice(0, LIMIT)
	}

	function getStatLabel(key: string) {
		const { label, name, lookupParam } =
			baseballStats.find((s) => [s.name, s.lookupParam].includes(key)) ?? {}

		const title = label ?? name ?? key

		if (key === 'doubles') return { abbr: '2B', title }
		if (key === 'triples') return { abbr: '3B', title }
		if (key === 'strikeOuts') return { abbr: 'K', title }
		if (key === 'baseOnBalls') return { abbr: 'BB', title }
		if (key === 'numberOfPitches') return { abbr: 'P', title }
		if (runningKeys.includes(key))
			return { abbr: lookupParam ?? key, title: `${title} (season to date)` }

		return { abbr: lookupParam ?? key, title }
	}

	function getDecision(stat: MLB.StatSplit['stat']) {
		if (Number(stat.wins)) return { text: 'W', class: 'positive' }
		if (Number(stat.losses)) return { text: 'L', class: 'negative' }
		if (Number(stat.saves)) return { text: 'S', class: 'positive' }
		if (Number(stat.blownSaves)) return { text: 'BS', class: 'negative' }
		if (Number(stat.holds)) return { text: 'H', class: undefined }
		return { text: '—', class: undefined }
	}
</script>

{#snippet empty()}
	<Empty>No recent games</Empty>
{/snippet}

{#if browser}
	{#await fetchLast20()}
		<Loading class="justify-center">Loading game log...</Loading>
	{:then rows}
		{#if rows.length}
			<article class="overflow-x-auto has-[table]:flex">
				<table class="min-w-full table-fixed text-center">
					<caption class="text-sm text-current/50">Last {rows.length} games</caption>

					<thead class="text-sm">
						<tr>
							<th class="w-[6ch] min-w-[6ch]"></th>
							<th class="w-[3ch] min-w-[3ch]"></th>
							<th class="w-[calc(1lh+5ch)] min-w-[calc(1lh+5ch)]"></th>
							<th class="px-[.5ch]">
								<abbr class="text-current/40 uppercase" title="Team result">W/L</abbr>
							</th>

							{#if group === 'pitching'}
								<th class="px-[.5ch]">
									<abbr class="text-current/40 uppercase" title="Decision">Dec</abbr>
								</th>
							{/if}

							{#each statKeys[group] as key (key)}
								{@const { abbr, title } = getStatLabel(key)}
								<th class="px-[.5ch]">
									<abbr class="text-current/40 uppercase" {title}>{abbr}</abbr>
								</th>
							{/each}
						</tr>
					</thead>

					<tbody>
						{#each rows as split, i (split.game?.gamePk ?? i)}
							{@const opponent = split.opponent}
							{@const gamePk = split.game?.gamePk}
							{@const isPastSeason = split.date?.slice(0, 4) !== String(season)}
							{@const bg = opponent
								? `url(https://midfield.mlbstatic.com/v1/team/${opponent.id}/spots/32)`
								: undefined}

							<tr class="hover:[&>td]:bg-foreground/10 hover:[&>th]:bg-foreground/10">
								<th class="sticky left-0 z-1 bg-background px-[.5ch] text-left tabular-nums">
									{#if split.date}
										<a class="block" href={gamePk ? `/game/${gamePk}` : undefined}>
											<time datetime={split.date}>
												{formatDate(split.date, {
													month: 'numeric',
													day: 'numeric',
													year: isPastSeason ? '2-digit' : undefined,
												})}
											</time>
										</a>
									{:else}
										—
									{/if}
								</th>

								<td class="text-sm text-current/50">{split.isHome ? 'vs' : '@'}</td>

								<td
									class={cn('relative', {
										'dark:text-dark': opponent && isDarkOnLightTeam(opponent),
										'dark:text-light': opponent && isLightOnDarkTeam(opponent),
									})}
									style:--team-bg={bg}
								>
									{#if opponent}
										<a
											class="flex items-center justify-center gap-[.5ch]"
											href="/teams/{opponent.id}"
											aria-label={opponent.name}
										>
											<Logo class="size-lh object-contain" team={opponent} />
											<span class="text-sm">{opponent.abbreviation}</span>
										</a>
									{/if}
								</td>

								<td
									class={cn(
										'tabular-nums',
										split.isWin === true && 'positive',
										split.isWin === false && 'negative',
									)}
								>
									{split.isWin == null ? '—' : split.isWin ? 'W' : 'L'}
								</td>

								{#if group === 'pitching'}
									{@const decision = getDecision(split.stat)}
									<td class={cn('tabular-nums', decision.class)}>{decision.text}</td>
								{/if}

								{#each statKeys[group] as key (key)}
									<td class="tabular-nums">{split.stat[key] ?? '—'}</td>
								{/each}
							</tr>
						{/each}
					</tbody>
				</table>
			</article>
		{:else}
			{@render empty()}
		{/if}
	{:catch}
		{@render empty()}
	{/await}
{:else}
	<!-- Skip during SSR: the fetch can't finish before the response streams, so it only holds the serverless instance open. -->
	<Loading class="justify-center">Loading game log...</Loading>
{/if}

<style>
	td {
		padding-inline: 1ch;
		min-width: 4ch;
	}
</style>
