<script lang="ts">
	import { isDarkOnLightTeam, isLightOnDarkTeam } from '#lib/colors.js'
	import { cn } from '#lib/utils.js'
	import Divider from '#ui/divider.svelte'
	import Logo from '#ui/team/logo.svelte'

	let {
		person,
	}: {
		person: MLB.Person & {
			awards?: MLB.Award[]
		}
	} = $props()

	/**
	 * One row per award per season, latest first; repeats in a season (e.g. Player of the Week) are counted.
	 * `nth` is how many times the award had been won by that row's last win, and `total` across the career.
	 */
	const rows = $derived.by(() => {
		const byKey = new Map<
			string,
			{
				key: string
				id: string
				name: string
				season?: string
				team?: MLB.Team
				count: number
				nth: number
				total: number
			}
		>()

		const sorted = (person.awards ?? []).toSorted((a, b) =>
			(b.date ?? b.season ?? '').localeCompare(a.date ?? a.season ?? ''),
		)

		for (const { id, name, season, team } of sorted) {
			const key = `${season}-${id}`
			const row = byKey.get(key) ?? {
				key,
				id,
				name,
				season,
				team,
				count: 0,
				nth: 0,
				total: 0,
			}
			row.count++
			byKey.set(key, row)
		}

		const rows = [...byKey.values()]
		const wins = new Map<string, number>()

		for (const row of rows.toReversed()) {
			row.nth = (wins.get(row.id) ?? 0) + row.count
			wins.set(row.id, row.nth)
		}

		for (const row of rows) row.total = wins.get(row.id)!

		return rows
	})
</script>

{#if rows.length}
	<section class="px-ch">
		<Divider>Awards</Divider>

		<article class="overflow-x-auto has-[table]:flex">
			<table class="mx-auto table-fixed">
				<tbody>
					{#each rows as { key, name, season, team, count, nth, total } (key)}
						{@const bg = team
							? `url(https://midfield.mlbstatic.com/v1/team/${team.id}/spots/32)`
							: undefined}

						<tr class="hover:[&>td]:bg-foreground/10 hover:[&>th]:bg-foreground/10">
							<th
								class={cn(
									'sticky left-0 z-1 w-[5ch] min-w-[5ch] px-[.5ch] text-left tabular-nums',
									!team && 'bg-background',
									team && {
										'dark:text-dark': isDarkOnLightTeam(team),
										'dark:text-light': isLightOnDarkTeam(team),
									},
								)}
								style:--team-bg={bg}
							>
								{season}
							</th>

							<td
								class={cn('relative w-lh min-w-lh', {
									'dark:text-dark': team && isDarkOnLightTeam(team),
									'dark:text-light': team && isLightOnDarkTeam(team),
								})}
								style:--team-bg={bg}
							>
								{#if team}
									<a class="block" href="/teams/{team.id}" aria-label={team.name}>
										<Logo class="mx-auto size-lh object-contain" {team} />
									</a>
								{/if}
							</td>

							<td class="text-sm text-current/50 tabular-nums">
								{#if count > 1}
									×{count}
								{:else if total > 1}
									#{nth}
								{/if}
							</td>

							<td class="text-left">{name}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</article>
	</section>
{/if}

<style>
	td {
		padding-inline: 1ch;
		min-width: 4ch;
	}
</style>
