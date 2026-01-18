<script lang="ts">
	import { fetchMLB } from '$lib/fetch'
	import { formatDate } from '$lib/temporal'
	import Loading from '$ui/loading.svelte'

	let { game }: { game: MLB.Game } = $props()

	async function fetchBoxscore() {
		return await fetchMLB<MLB.Boxscore>(`/api/v1/game/${game.gamePk}/boxscore`, {
			fields: 'teams,away,team,id,teamName',
		})
	}
</script>

<article class="grid items-center gap-x-ch" data-gamePk={game.gamePk}>
	<time
		datetime={game.gameDate}
		class="grid w-[8ch] place-content-center text-center text-sm leading-none tabular-nums"
		style:grid-area="status"
	>
		{#if game.status.abstractGameState === 'Final'}
			{game.status.reason || game.status.detailedState || game.status.abstractGameState}
		{:else}
			{formatDate(game.gameDate, { hour: '2-digit', minute: '2-digit' })}
		{/if}
	</time>

	<small class="grid items-end text-center sm:h-rlh" style:grid-area="description">
		{game.description}
	</small>

	<div style:grid-area="boxscore">
		{#await fetchBoxscore()}
			<Loading>Loading...</Loading>
		{:then boxscore}
			<div class="grid grid-cols-2">
				{@render team(boxscore.teams.away.team)}
				{@render team(boxscore.teams.home.team)}
			</div>
		{/await}
	</div>
</article>

{#snippet team(team: MLB.Team)}
	{@const src = `https://midfield.mlbstatic.com/v1/team/${team.id}/spots`}

	<figure
		class="relative inline-flex items-center gap-[.5ch] px-[.5ch] not-dark:before:opacity-10"
		style:--bg="url('{src}/32')"
	>
		<picture>
			<source srcset="{src}/72" media="(prefers-color-scheme: dark)" />

			<img
				class="size-lh"
				src="https://www.mlbstatic.com/team-logos/team-cap-on-light/{team.id}.svg"
				width="72"
				height="72"
				alt={team.name}
				draggable="false"
			/>
		</picture>

		<figcaption>{team.teamName}</figcaption>
	</figure>
{/snippet}

<style>
	article {
		grid-template:
			'. description' 1fr
			'status	boxscore' auto / auto 1fr;
	}

	figure::before {
		content: '';
		position: absolute;
		inset: 0;
		z-index: -1;
		background-image: var(--bg);
		background-size: 1500% 1500%;
		background-position: 50% 5%;
	}
</style>
