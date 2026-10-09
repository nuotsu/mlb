<script lang="ts">
	import Logo from '#ui/team/logo.svelte'
	import { SvelteSet } from 'svelte/reactivity'

	let {
		person,
	}: {
		person: MLB.Person & {
			currentTeam?: MLB.Team
			stats: MLB.PlayerStats[]
			rosterEntries?: MLB.Roster[]
			drafts?: MLB.DraftPick[]
		}
	} = $props()

	/** How far past a playing career to look for coach and manager headshots. */
	const LOOKBACK = 30

	const thisYear = new Date().getFullYear()

	/** Still on a staff, so this year's headshot may only be published as `current`. */
	const employed = $derived(!!(person.active || person.currentTeam))

	/**
	 * Every year that might have a headshot, newest first. Stats and roster entries
	 * cover playing years (with teams); coaches and managers are photographed with
	 * no stats to show for it, so years after the last known one are probed too and
	 * the ones the CDN doesn't have drop out.
	 */
	const seasons = $derived.by(() => {
		const teamsBySeason = new Map<number, Map<number, MLB.Team>>()

		function add(season: number, team?: MLB.Team) {
			const teams = teamsBySeason.get(season) ?? new Map()
			if (team?.id) teams.set(team.id, team)
			teamsBySeason.set(season, teams)
		}

		for (const { type, splits } of person.stats ?? []) {
			if (type?.displayName !== 'yearByYear') continue
			for (const { season, team } of splits ?? []) if (season) add(Number(season), team)
		}

		for (const { team, startDate, endDate, isActive } of person.rosterEntries ?? []) {
			if (!startDate || team.parentOrgId) continue
			const start = Number(startDate.slice(0, 4))
			const end = endDate ? Number(endDate.slice(0, 4)) : isActive ? thisYear : start
			for (let y = start; y <= end; y++) add(y, team)
		}

		const known = [...teamsBySeason.keys()]
		const lastKnown = known.length ? Math.max(...known) : undefined

		if (employed || (lastKnown && lastKnown >= thisYear - LOOKBACK)) {
			const debut = [person.mlbDebutDate, person.drafts?.[0]?.year]
				.map((d) => Number(d?.slice(0, 4)))
				.filter(Boolean)
			const first = Math.max(Math.min(...known, ...debut, thisYear), thisYear - LOOKBACK)

			for (let y = first; y <= thisYear; y++) if (!teamsBySeason.has(y)) add(y)
		}

		if (employed && person.currentTeam && !teamsBySeason.get(thisYear)?.size)
			add(thisYear, person.currentTeam)

		return [...teamsBySeason]
			.map(([season, teams]) => ({ season: String(season), teams: [...teams.values()] }))
			.sort((a, b) => Number(b.season) - Number(a.season))
	})

	/**
	 * The year whose headshot may still only live at `current`, before it's archived
	 * under its year: this year if still on a staff, otherwise the last year on record.
	 */
	const currentSeason = $derived(
		employed ? String(thisYear) : seasons.find(({ teams }) => teams.length)?.season,
	)

	const usesCurrent = new SvelteSet<string>()
	const loaded = new SvelteSet<string>()
</script>

<!-- Every candidate year is requested up front but stays hidden until its headshot loads -->
<section class="px-ch" class:hidden={!loaded.size}>
	<ol class="flex items-end gap-ch overflow-x-auto overflow-y-clip before:m-auto after:m-auto">
		{#each seasons as { season, teams } (season)}
			{@const src = `https://img.mlbstatic.com/mlb-photos/image/upload/w_240,q_auto:best/v1/people/${person.id}/headshot/silo/${usesCurrent.has(season) ? 'current' : season}`}

			<li class="flex shrink-0 flex-col items-center" class:hidden={!loaded.has(season)}>
				<img
					class="aspect-4/5 h-[5lh] w-auto object-contain object-bottom text-transparent"
					{src}
					width={240}
					height={300}
					alt="{person.fullName} in {season}"
					draggable="false"
					onload={() => loaded.add(season)}
					onerror={() => {
						if (season === currentSeason && !usesCurrent.has(season)) usesCurrent.add(season)
					}}
				/>

				<div class="flex items-center gap-[.25ch] border-t border-stroke pt-[.25lh]">
					{#each teams as team (team.id)}
						<a href="/teams/{team.id}" aria-label={team.name}>
							<Logo class="size-lh object-contain" {team} title={team.name} />
						</a>
					{/each}

					<time class="text-xs text-current/50" datetime={season}>{season}</time>
				</div>
			</li>
		{/each}
	</ol>
</section>
