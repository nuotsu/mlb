<script lang="ts">
	import { formatDate, getToday, slash } from '$lib/temporal'
	import StyledTeam from '$ui/team/styled-team.svelte'

	let {
		schedule,
		team,
	}: {
		schedule: MLB.ScheduleResponse
		team: MLB.TeamDetailed
	} = $props()

	const byMonth = $derived(
		Object.entries(
			(schedule?.dates ?? []).reduce(
				(acc, date) => {
					const month = date.date.slice(0, 7)
					;(acc[month] ??= []).push(date)
					return acc
				},
				{} as Record<string, typeof schedule.dates>,
			),
		),
	)

	const currentMonth = getToday().toISOString().slice(0, 7)
</script>

<article class="space-y-px sm:px-ch">
	{#each byMonth as [month, dates], i (month)}
		<details class="accordion" name="schedule" open={month === currentMonth || i === 0}>
			<summary class="flex items-center gap-ch max-sm:px-ch">
				{formatDate(slash(month + '-01'), { month: 'long', year: 'numeric' })}
			</summary>

			<ol class="grid overflow-x-auto whitespace-nowrap">
				{#each dates as { date, games } (date)}
					{#each games as { gamePk, gameDate, teams, venue } (gamePk)}
						{@const atHome = teams.home.team.id === team.id}
						<li class="col-span-full grid grid-cols-subgrid">
							<a
								class="group/game col-span-full grid grid-cols-subgrid items-center *:px-[.5ch]"
								href="/game/{gamePk}"
							>
								<time class="contents text-center text-sm *:px-[.5ch]" datetime={gameDate}>
									<span
										class="sticky left-0 z-1 bg-background/50 decoration-dashed backdrop-blur group-hover/game:underline"
									>
										{formatDate(slash(date), {
											weekday: 'short',
											month: 'numeric',
											day: 'numeric',
										})}
									</span>

									<span>
										{formatDate(gameDate, {
											hour: 'numeric',
											minute: '2-digit',
										})}
									</span>
								</time>

								<span class="pr-ch! text-center text-sm">
									{atHome ? 'vs' : '@'}
								</span>

								<StyledTeam class="pl-[.5ch]" team={atHome ? teams.away.team : teams.home.team}>
									<small class="line-clamp-1 pl-ch text-[x-small] break-all text-current/75">
										{venue.name}
									</small>
								</StyledTeam>
							</a>
						</li>
					{/each}
				{/each}
			</ol>
		</details>
	{/each}
</article>

<style>
	ol {
		grid-template-columns: auto auto auto minmax(8ch, 1fr);
	}
</style>
