<script lang="ts">
	import { formatDate, getToday, slash } from '$lib/temporal'
	import Empty from '$ui/empty.svelte'
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

<article class="space-y-ch">
	{#if byMonth.length > 0}
		<h2 class="h2 max-sm:px-ch">Schedule</h2>

		<div class="space-y-px">
			{#each byMonth as [month, dates], i (month)}
				<details class="accordion" name="schedule" open={month === currentMonth || i === 0}>
					<summary class="sticky-below-header z-1 backdrop-blur-xs max-sm:px-ch">
						{formatDate(slash(month + '-01'), { month: 'long', year: 'numeric' })}
					</summary>

					<ol class="isolate grid overflow-x-auto">
						{#each dates as { date, games } (date)}
							{#each games as { gamePk, gameDate, teams, venue } (gamePk)}
								{@const atHome = teams.home.team.id === team.id}
								<li class="col-span-full grid grid-cols-subgrid">
									<a
										class="group/game col-span-full grid grid-cols-subgrid items-stretch *:px-[.5ch]"
										href="/game/{gamePk}"
									>
										<time
											class="my-auto contents text-center text-xs *:m-auto *:px-[.5ch]"
											datetime={gameDate}
										>
											<span class="decoration-dashed group-hover/game:underline">
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

										<span class="m-auto text-center text-xs">
											{atHome ? 'vs' : '@'}
										</span>

										<StyledTeam
											class="pl-[.5ch] *:data-name:shrink-0 *:data-name:grow"
											team={atHome ? teams.away.team : teams.home.team}
										>
											<small class="line-clamp-1 pl-ch text-[x-small] break-all text-current/50">
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
		</div>
	{:else}
		<Empty>No schedule</Empty>
	{/if}
</article>

<style>
	ol {
		grid-template-columns: auto auto auto minmax(8ch, 1fr);
	}
</style>
