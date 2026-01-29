<script lang="ts">
	import { formatDate, getToday, slash } from '$lib/temporal'
	import Metadata from '$ui/metadata.svelte'
	import Logo from '$ui/team/logo.svelte'
	import type { PageProps } from './$types'

	let { data }: PageProps = $props()

	const team = $derived(data.team as MLB.TeamDetailed)
	const schedule = $derived(data.schedule)

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

<Metadata title="{team.name} | MLB.TheOhtani.com" description="{team.name} team page" />

<section class="p-ch">
	<header class="flex flex-wrap items-end gap-ch">
		<Logo class="size-[4lh] shrink-0 rounded-none bg-transparent" {team} />

		<h1 class="grid">
			<span>{team.locationName}</span>
			<strong class="text-3xl">{team.teamName}</strong>
		</h1>
	</header>

	<article>
		<h2>Schedule</h2>

		{#each byMonth as [month, dates], i (month)}
			<details name="schedule" open={month === currentMonth || i === 0}>
				<summary>
					{formatDate(slash(month + '-01'), { month: 'long', year: 'numeric' })}
				</summary>

				<ol class="grid gap-x-ch">
					{#each dates as { date, games } (date)}
						{#each games as { gamePk, gameDate, teams } (gamePk)}
							{@const atHome = teams.home.team.id === team.id}
							<li class="col-span-full grid grid-cols-subgrid">
								<a class="group/game col-span-full grid grid-cols-subgrid" href="/game/{gamePk}">
									<time class="contents text-center" datetime={gameDate}>
										<span class="decoration-dashed group-hover/game:underline">
											{formatDate(slash(date), {
												weekday: 'short',
												month: 'short',
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

									<span class="text-center">
										{atHome ? 'vs' : '@'}
									</span>

									<span class="flex items-center gap-ch">
										<Logo
											class="shrin-0 size-lh"
											team={atHome ? teams.away.team : teams.home.team}
										/>
										{atHome ? teams.away.team.abbreviation : teams.home.team.abbreviation}
									</span>
								</a>
							</li>
						{/each}
					{/each}
				</ol>
			</details>
		{/each}
	</article>
</section>

<style>
	ol {
		grid-template-columns: auto auto auto 1fr;
	}
</style>
