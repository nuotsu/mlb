<script lang="ts">
	import { browser } from '$app/environment'
	import { fetchPitchingGameLogs } from '$lib/fetch/presets'
	import { formatDate, slash } from '$lib/temporal'
	import { cn } from '$lib/utils'
	import Empty from '$ui/empty.svelte'
	import Loading from '$ui/loading.svelte'
	import Headshot from '$ui/player/headshot.svelte'

	let {
		team,
		gameDate,
		class: className,
	}: {
		team: MLB.TeamBoxscore
		gameDate: string
		class?: string
	} = $props()

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

	function daysBetween(from: string, to: string) {
		const a = new Date(slash(from)).getTime()
		const b = new Date(slash(to)).getTime()
		return Math.round((b - a) / 86_400_000)
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

{#snippet heading()}
	<h3 class="flex min-h-rlh items-center px-rch text-xs text-current/40 max-sm:px-ch">
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
			<ul class={cn('grid gap-px px-rch max-sm:px-ch', className)}>
				{#each rows as row (row.person.id)}
					<li class="flex items-center gap-x-ch hover:bg-current/10">
						<a
							href="/player/{row.person.id}"
							class="group/player flex min-w-0 shrink-0 items-center gap-x-ch"
						>
							<Headshot person={row.person} size={72} class="size-lh shrink-0" />
							<span
								class="line-clamp-1 w-[12ch] break-all text-sm decoration-dashed group-hover/player:underline sm:w-[14ch]"
							>
								{row.person.lastInitName}
							</span>
							{#if row.throwSide}
								<small class="w-[1.5ch] shrink-0 text-xs text-current/40 no-underline">
									{row.throwSide}
								</small>
							{/if}
						</a>

						<div
							class="hp-bar relative h-[.5lh] max-w-[16ch] min-w-0 flex-1 rounded-sm"
							style:--hp="calc({row.hp} * 100%)"
							style:--hp-fill={fatigueColor(row.hp)}
							title="Fatigue {Math.round(row.fatigue)}"
							role="meter"
							aria-valuemin={0}
							aria-valuemax={100}
							aria-valuenow={Math.round(row.hp * 100)}
							aria-label="{row.person.lastInitName} bullpen health"
						></div>

						<span class="w-[12ch] shrink-0 text-right text-xs text-current/60 tabular-nums">
							{row.inningsPitched} IP · {row.pitches}
						</span>
					</li>
				{/each}
			</ul>
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
