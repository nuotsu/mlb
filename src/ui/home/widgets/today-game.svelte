<script lang="ts">
	import { isDarkOnLightTeam, isLightOnDarkTeam } from '#lib/colors.js'
	import { formatDate } from '#lib/temporal.js'
	import { readStoredDelay } from '#lib/time-travel.js'
	import { spoilerPreventionStore } from '#ui/spoiler-prevention/store.svelte.js'
	import TeamAvatar from '#ui/team/avatar.svelte'

	let {
		game,
		favorite,
	}: {
		game: MLB.Game & { linescore?: MLB.Linescore }
		/** One of the teams is a favorite */
		favorite: boolean
	} = $props()

	const { away, home } = $derived(game.teams)
	const state = $derived(game.status.abstractGameState)
	const spoilerPrevented = $derived(
		spoilerPreventionStore.has(away.team.id) || spoilerPreventionStore.has(home.team.id),
	)
	/** Watching this game behind live (time travel): the real score would spoil it */
	const delayed = $derived(readStoredDelay(localStorage, game.gamePk) != null)
	const showScore = $derived(state !== 'Preview' && !spoilerPrevented && !delayed)

	const status = $derived.by(() => {
		const { linescore } = game
		if (delayed) return 'Behind live'
		if (state === 'Preview' || spoilerPrevented) {
			return game.status.reason || game.status.detailedState === 'Postponed'
				? game.status.detailedState
				: formatDate(game.gameDate, { hour: 'numeric', minute: '2-digit' })
		}
		if (state === 'Live') {
			return linescore?.currentInning
				? `${linescore.inningState?.slice(0, 3)} ${linescore.currentInning}`
				: game.status.detailedState
		}
		const extras =
			linescore?.currentInning &&
			linescore.scheduledInnings &&
			linescore.currentInning > linescore.scheduledInnings
		return `${game.status.detailedState}${extras ? `/${linescore.currentInning}` : ''}`
	})
</script>

<li>
	<a
		href="/game/{game.gamePk}"
		class={[
			'grid border text-sm transition-colors hover:border-accent',
			favorite ? 'border-green-700/50 dark:border-accent/60' : 'border-stroke',
		]}
		data-gamepk={game.gamePk}
		data-time-travel={delayed ? 'delayed' : 'live'}
	>
		{#each [away, home] as side (side.team.id)}
			{@const { team } = side}

			<div
				class={[
					'relative isolate flex items-center gap-[.5ch] px-[.5ch] py-[.25ch]',
					isDarkOnLightTeam(team) && 'dark:text-dark',
					isLightOnDarkTeam(team) && 'dark:text-light',
				]}
				style:--team-bg="url('https://midfield.mlbstatic.com/v1/team/{team.id}/spots/32')"
			>
				<TeamAvatar class="size-[1.25em]" teamId={team.id} />
				<span class="font-mono">{team.abbreviation ?? team.name}</span>
				{#if showScore}
					<span
						class={[
							'ml-auto font-mono tabular-nums',
							state === 'Final' && side.isWinner && 'font-bold',
						]}
					>
						{side.score ?? 0}
					</span>
				{/if}
			</div>
		{/each}

		<p class="flex items-center gap-[.5ch] px-[.5ch] py-[.25ch] text-xs text-current/60">
			{#if state === 'Live' && showScore}
				<span class="animate-pulse positive dark:text-accent" aria-hidden="true">•</span>
			{/if}
			{status}
		</p>
	</a>
</li>
