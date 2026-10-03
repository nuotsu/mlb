<script lang="ts">
	import { fetchMLB } from '#lib/fetch/index.js'
	import Headshot from '#ui/player/headshot.svelte'

	let { game }: { game: MLB.Game } = $props()

	async function fetchProbablePitchers() {
		return await fetchMLB<MLB.LiveGameFeed>(`/api/v1.1/game/${game.gamePk}/feed/live`, {
			fields: ['gameData,probablePitchers', 'away,home,id,fullName', 'teams,name,sport'],
		})
	}
</script>

{#await fetchProbablePitchers() then { gameData }}
	<div class="z-1 grid grid-cols-2 backdrop-blur-xs" style:grid-area="pregame">
		{@render pitcher({
			pitcher: gameData.probablePitchers?.away,
			team: gameData.teams.away,
			className: 'flex-row-reverse pl-ch',
		})}
		{@render pitcher({
			pitcher: gameData.probablePitchers?.home,
			team: gameData.teams.home,
			className: 'pr-ch',
		})}
	</div>
{/await}

{#snippet pitcher({
	pitcher,
	team,
	className,
}: {
	pitcher?: MLB.Person
	team?: MLB.Team
	className?: string
})}
	{@const bg = team
		? `url(https://midfield.mlbstatic.com/v1/team/${team?.id}/spots/32)`
		: undefined}

	<div>
		{#if pitcher}
			<a
				class="group/pitcher relative flex items-center justify-between gap-ch before:opacity-5 dark:before:opacity-50 {className}"
				href="/player/{pitcher.id}"
				style:--team-bg={bg}
			>
				<Headshot person={pitcher} class="size-lh shrink-0" type="silo" />
				<span class="line-clamp-1 break-all decoration-dashed group-hover/pitcher:underline">
					{pitcher.fullName}
				</span>
			</a>
		{/if}
	</div>
{/snippet}
