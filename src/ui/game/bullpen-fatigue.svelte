<script lang="ts">
	import { fetchPitchingGameLogs } from '#lib/fetch/presets.js'
	import { daysBetween, formatDate, slash } from '#lib/temporal.js'
	import { cn } from '#lib/utils.js'
	import PlayerCell from '#ui/data-table/cells/player-cell.svelte'
	import DataTable from '#ui/data-table/data-table.svelte'
	import type { CellArgs, DataTableColumn } from '#ui/data-table/types.js'
	import Empty from '#ui/empty.svelte'
	import Loading from '#ui/loading.svelte'
	import { browser } from '$app/env'

	let {
		team,
		gameDate,
		id,
		class: className,
	}: { team: MLB.TeamBoxscore; gameDate: string; id?: string; class?: string } = $props()
	const WINDOW_DAYS = 14
	const FATIGUE_CAP = 100
	const BACK_TO_BACK_PENALTY = 10

	type Appearance = {
		date: string
		pitches: number
		outs: number
		gamesStarted: number
	}

	type BullpenRow = {
		person: MLB.Person
		throwSide: string
		inningsPitched: string
		pitches: number
		fatigue: number
		hp: number
	}

	const columns: DataTableColumn<BullpenRow>[] = [
		{
			id: 'pitcher',
			header: 'Pitcher',
			value: (row) => row.person.lastInitName,
			sticky: true,
			rowHeader: true,
			cell: pitcherCell,
			class: 'min-w-[12ch] pl-0',
		},
		{
			id: 'throws',
			header: 'T',
			title: 'Throws',
			value: (row) => row.throwSide,
			align: 'center',
			cellClass: 'text-xs text-current/40',
		},
		{
			id: 'fatigue',
			header: 'Rest',
			title: 'Bullpen health: full when rested, empty when worn out',
			value: (row) => row.hp,
			numeric: true,
			align: 'left',
			cell: meterCell,
			class: 'w-[8ch] min-w-[6ch] sm:w-[16ch]',
		},
		{
			id: 'pitches',
			header: 'IP · P',
			title: 'Innings and pitches thrown over the last 14 days',
			value: (row) => row.pitches,
			numeric: true,
			format: (_, row) => `${row.inningsPitched} IP · ${row.pitches}`,
			cellClass: 'text-xs whitespace-nowrap text-current/60',
			class: 'pr-0',
		},
	]

	function toDateKey(date: string) {
		return date.includes('T') ? date.slice(0, 10) : formatDate(date, { locale: 'en-CA' })
	}

	function ipToOuts(ip: string | number | undefined) {
		if (ip == null || ip === '') return 0
		const [whole, frac = '0'] = String(ip).split('.')
		return Number(whole) * 3 + Number(frac)
	}

	function outsToIp(outs: number) {
		return `${Math.floor(outs / 3)}.${outs % 3}`
	}

	function fatigueColor(hp: number) {
		if (hp > 0.5) {
			const t = Math.round((1 - hp) * 2 * 100)
			return `color-mix(in oklab, var(--color-yellow-500) ${t}%, var(--color-green-600))`
		}
		const t = Math.round((0.5 - hp) * 2 * 100)
		return `color-mix(in oklab, var(--color-red-500) ${t}%, var(--color-yellow-500))`
	}

	function scoreFatigue(appearances: Appearance[], anchorDate: string) {
		const sorted = [...appearances].sort((a, b) => a.date.localeCompare(b.date))
		let fatigue = 0
		let outs = 0
		let pitches = 0

		for (let i = 0; i < sorted.length; i++) {
			const app = sorted[i]
			const daysAgo = daysBetween(app.date, anchorDate)
			const weight = Math.max(0, (WINDOW_DAYS - daysAgo) / WINDOW_DAYS)

			fatigue += app.pitches * weight
			outs += app.outs
			pitches += app.pitches

			if (i > 0 && daysBetween(sorted[i - 1].date, app.date) === 1) {
				fatigue += BACK_TO_BACK_PENALTY
			}
		}

		return {
			fatigue,
			hp: 1 - Math.min(fatigue / FATIGUE_CAP, 1),
			inningsPitched: outsToIp(outs),
			pitches,
		}
	}

	function windowCutoff(anchorDate: string) {
		const d = new Date(slash(anchorDate))
		d.setDate(d.getDate() - (WINDOW_DAYS - 1))
		return formatDate(d, { locale: 'en-CA' })
	}

	function displayName(person: MLB.Person) {
		if (person.lastInitName) return person.lastInitName

		const initial = person.firstName?.[0] ?? person.useName?.[0] ?? ''

		return person.lastName ? `${person.lastName}, ${initial}` : (person.fullName ?? '')
	}

	const cache = new Map<string, Promise<BullpenRow[]>>()

	async function buildBullpenFatigue(
		teamId: number,
		pitcherIds: number[],
		starterId: number | undefined,
		anchorDate: string,
	): Promise<BullpenRow[]> {
		const season = String(new Date(slash(anchorDate)).getFullYear())
		const cutoff = windowCutoff(anchorDate)
		const people = await fetchPitchingGameLogs(pitcherIds, season)

		const byId = new Map(
			(people.people ?? []).map((person) => [
				person.id,
				person as MLB.Person & { stats?: MLB.PlayerStats[] },
			]),
		)

		const rows: BullpenRow[] = []

		for (const pitcherId of pitcherIds) {
			const boxPlayer = team.players[`ID${pitcherId}`]
			const person = byId.get(pitcherId) ?? boxPlayer?.person

			if (!person) continue

			const splits =
				(person as MLB.Person & { stats?: MLB.PlayerStats[] }).stats?.flatMap(
					(s) => s.splits ?? [],
				) ?? []
			const windowSplits: Appearance[] = []
			const fatigueSplits: Appearance[] = []

			for (const split of splits) {
				if (!split.date || split.date < cutoff || split.date > anchorDate) continue
				const appearance: Appearance = {
					date: split.date,
					pitches: Number(split.stat.numberOfPitches ?? 0),
					outs: ipToOuts(split.stat.inningsPitched as string | number | undefined),
					gamesStarted: Number(split.stat.gamesStarted ?? 0),
				}
				windowSplits.push(appearance)
				if (split.date < anchorDate) fatigueSplits.push(appearance)
			}

			const startedInWindow = windowSplits.some((a) => a.gamesStarted > 0)

			if (startedInWindow || pitcherId === starterId) continue

			const scored = scoreFatigue(fatigueSplits, anchorDate)

			rows.push({
				person: {
					...person,
					lastInitName: displayName(person),
				},
				throwSide: person.pitchHand?.code ?? '',
				...scored,
			})
		}

		return rows.sort(
			(a, b) =>
				b.fatigue - a.fatigue ||
				(a.person.lastInitName ?? '').localeCompare(b.person.lastInitName ?? ''),
		)
	}

	function fetchBullpenFatigue() {
		const pitcherIds = [...new Set([...(team.pitchers ?? []), ...(team.bullpen ?? [])])]
		const starterId = team.pitchers?.[0]
		const anchorDate = toDateKey(gameDate)
		const key = `${team.team.id}-${anchorDate}-${pitcherIds.join(',')}`
		if (!cache.has(key)) {
			cache.set(key, buildBullpenFatigue(team.team.id, pitcherIds, starterId, anchorDate))
		}
		return cache.get(key)!
	}
</script>

{#snippet pitcherCell({ row }: CellArgs<BullpenRow>)}
	<PlayerCell
		person={row.person}
		name={row.person.lastInitName}
		nameClass="text-sm"
		class="pr-ch"
	/>
{/snippet}

{#snippet meterCell({ row }: CellArgs<BullpenRow>)}
	<div
		class="hp-bar relative h-[.5lh] rounded-sm"
		style:--hp="calc({row.hp} * 100%)"
		style:--hp-fill={fatigueColor(row.hp)}
		title="Fatigue {Math.round(row.fatigue)}"
		role="meter"
		aria-valuemin={0}
		aria-valuemax={100}
		aria-valuenow={Math.round(row.hp * 100)}
		aria-label="{row.person.lastInitName} bullpen health"
	></div>
{/snippet}

{#snippet heading()}
	<h3 {id} class="flex min-h-rlh items-center px-rch text-xs text-current/40 max-sm:px-ch">
		Bullpen Fatigue (Last 14 days)
	</h3>
{/snippet}

{#if browser}
	{#await fetchBullpenFatigue()}
		{@render heading()}
		<div class={cn('px-rch max-sm:px-ch', className)}>
			<Loading class="justify-center">Loading...</Loading>
		</div>
	{:then rows}
		{@render heading()}
		{#if rows.length === 0}
			<div class={cn('px-rch max-sm:px-ch', className)}>
				<Empty>No bullpen usage</Empty>
			</div>
		{:else}
			<DataTable
				class={cn('px-rch max-sm:px-ch', className)}
				label="{team.team.name} bullpen fatigue"
				data={rows}
				{columns}
				getRowId={(row) => String(row.person.id)}
				stickyHeader={false}
				tableClass="min-w-0"
			/>
		{/if}
	{:catch}
		{@render heading()}
		<div class={cn('px-rch max-sm:px-ch', className)}>
			<Empty>Failed to load bullpen fatigue</Empty>
		</div>
	{/await}
{:else}
	{@render heading()}
	<div class={cn('px-rch max-sm:px-ch', className)}>
		<Loading class="justify-center">Loading...</Loading>
	</div>
{/if}

<style>
	.hp-bar {
		background-image: linear-gradient(
			to right,
			var(--hp-fill),
			var(--hp-fill) var(--hp),
			color-mix(in srgb, var(--color-foreground) 10%, transparent) var(--hp)
		);
	}
</style>
