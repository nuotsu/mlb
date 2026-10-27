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

	/** One row per award per season, latest first; repeats in a season (e.g. Player of the Week) are counted. */
	const rows = $derived.by(() => {
		const byKey = new Map<
			string,
			{ key: string; name: string; season?: string; team?: MLB.Team; count: number }
		>()

		const sorted = (person.awards ?? []).toSorted((a, b) =>
			(b.date ?? b.season ?? '').localeCompare(a.date ?? a.season ?? ''),
		)

		for (const { id, name, season, team } of sorted) {
			const key = `${season}-${id}`
			const row = byKey.get(key) ?? {
				key,
				name,
				season,
				// Award teams carry `teamName` rather than `name`
				team:
					team &&
					({
						...team,
						name: team.name ?? (team as MLB.Team & { teamName?: string }).teamName,
					} as MLB.Team),
				count: 0,
			}
			row.count++
			byKey.set(key, row)
		}

		return [...byKey.values()]
	})
</script>

{#if rows.length}
	<section class="px-ch">
		<Divider>Awards</Divider>

		<article class="overflow-x-auto has-[table]:flex">
			<table class="mx-auto table-fixed">
				<tbody>
					{#each rows as { key, name, season, team, count } (key)}
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

							<td class="relative w-lh min-w-lh" style:--team-bg={bg}>
								{#if team}
									<a class="block" href="/teams/{team.id}" aria-label={team.name}>
										<Logo class="mx-auto size-lh object-contain" {team} />
									</a>
								{/if}
							</td>

							<td class="px-ch">
								{name}

								{#if count > 1}
									<small class="text-current/50">×{count}</small>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</article>
	</section>
{/if}
