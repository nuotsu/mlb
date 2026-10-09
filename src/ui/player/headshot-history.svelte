<script lang="ts">
	import Divider from '#ui/divider.svelte'
	import Logo from '#ui/team/logo.svelte'
	import { SvelteSet } from 'svelte/reactivity'

	let {
		person,
	}: {
		person: MLB.Person & { stats: MLB.PlayerStats[] }
	} = $props()

	/** One entry per MLB season, with every team the player appeared for that year. */
	const seasons = $derived.by(() => {
		const teamsBySeason = new Map<string, Map<number, MLB.Team>>()

		for (const { type, splits } of person.stats ?? []) {
			if (type?.displayName !== 'yearByYear') continue

			for (const { season, team } of splits ?? []) {
				if (!season) continue
				const teams = teamsBySeason.get(season) ?? new Map()
				if (team?.id) teams.set(team.id, team)
				teamsBySeason.set(season, teams)
			}
		}

		return [...teamsBySeason]
			.map(([season, teams]) => ({ season, teams: [...teams.values()] }))
			.sort((a, b) => Number(b.season) - Number(a.season))
	})

	/** The latest season's headshot only lives at `current` until it's archived under its year. */
	const usesCurrent = new SvelteSet<string>()

	/** Seasons without a headshot on the CDN 404, so drop them once they fail to load. */
	const missing = new SvelteSet<string>()

	const visible = $derived(seasons.filter(({ season }) => !missing.has(season)))
</script>

{#if visible.length}
	<section class="px-ch">
		<Divider>Headshots</Divider>

		<ol class="flex items-end gap-ch overflow-x-auto overflow-y-clip before:m-auto after:m-auto">
			{#each visible as { season, teams } (season)}
				{@const src = `https://img.mlbstatic.com/mlb-photos/image/upload/w_240,q_auto:best/v1/people/${person.id}/headshot/silo/${usesCurrent.has(season) ? 'current' : season}`}

				<li class="flex shrink-0 flex-col items-center">
					<img
						class="img-fade aspect-4/5 h-[5lh] w-auto object-contain object-bottom text-transparent opacity-0 transition-opacity"
						{src}
						width={240}
						height={300}
						alt="{person.fullName} in {season}"
						draggable="false"
						loading="lazy"
						onload={(e) => e.currentTarget.classList.remove('opacity-0')}
						onerror={() => {
							if (season === seasons[0]?.season && !usesCurrent.has(season)) usesCurrent.add(season)
							else missing.add(season)
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
{/if}
