<script lang="ts">
	import { dueUp } from '#lib/due-up.js'
	import { cn } from '#lib/utils.js'
	import { favoritesStore } from '#ui/favorites/store.svelte.js'
	import Headshot from '#ui/player/headshot.svelte'
	import CurrentPitch from './current-pitch.svelte'

	let { liveGame }: { liveGame?: MLB.LiveGameFeed } = $props()

	const { linescore, boxscore } = $derived((liveGame?.liveData as MLB.LiveData) ?? {})
	const isMiddleOrEnd = $derived(['Middle', 'End'].includes(linescore?.inningState ?? ''))

	const { pitcher, pitchHand, batter, batSide } = $derived(
		(liveGame?.liveData?.plays.currentPlay?.matchup as MLB.Matchup) ?? {},
	)

	const { players } = $derived((liveGame?.gameData as MLB.GameData) ?? {})

	const battingSide = $derived(linescore?.inningHalf === 'Top' ? 'away' : 'home')

	/** Still at the plate, so not "next up" */
	const atBat = $derived(
		liveGame?.liveData?.plays.currentPlay?.about?.isComplete ? undefined : batter?.id,
	)

	const [{ pitching }, { batting }, ...lineups] = $derived([
		(boxscore?.teams[battingSide === 'away' ? 'home' : 'away'].players[`ID${pitcher?.id}`]
			.stats as unknown as MLB.TeamStats) ?? {},
		(boxscore?.teams[battingSide].players[`ID${batter?.id}`].stats as unknown as MLB.TeamStats) ??
			{},
		dueUp(linescore?.offense, {
			atBat,
			battingOrder: boxscore?.teams[battingSide].battingOrder,
		}),
		[linescore?.defense?.batter, linescore?.defense?.onDeck, linescore?.defense?.inHole],
	])
</script>

{#key `${pitcher?.id}-${batter?.id}`}
	<div
		class="mb-auto flex snap-x snap-mandatory overflow-x-auto pb-[.25ch] *:min-w-full *:snap-start *:snap-always *:px-[.25ch]"
		style:grid-area="matchup"
	>
		{#if !isMiddleOrEnd}
			<div>
				{@render player(
					{ person: pitcher, side: pitchHand },
					`P:${pitching?.numberOfPitches ?? 0}`,
				)}
				{@render player({ person: batter, side: batSide }, batting?.summary)}
				<CurrentPitch {liveGame} />
			</div>
		{/if}

		{#each lineups as [nextUp, onDeck, inHole]}
			<div>
				{#if nextUp && onDeck}
					{@render player({ person: nextUp }, 'Next up')}
					{@render player({ person: onDeck }, 'On deck')}
					{#if inHole}
						{@render player({ person: inHole }, 'In the hole')}
					{/if}
				{/if}
			</div>
		{/each}
	</div>
{/key}

{#snippet player(
	{
		person,
		side,
	}: {
		person: MLB.Person
		side?: MLB.PitchHand | MLB.BatSide
	},
	after?: string,
)}
	<div
		class={cn(
			'group/player relative flex h-lh items-center gap-x-[.5ch]',
			person &&
				favoritesStore.has(`/player/${person.id}`) &&
				'bg-accent text-dark [box-shadow:-.25ch_0_0_var(--color-accent),.25ch_0_0_var(--color-accent)]',
		)}
	>
		{#if person}
			{@const player = players[`ID${person.id}`] as unknown as MLB.Person}

			<span class="relative shrink-0">
				<Headshot {person} class="size-lh" />

				{#if side?.code}
					<small
						class={cn(
							'absolute bottom-0 grid aspect-square w-lh place-content-center rounded-full bg-foreground text-[6px] font-bold text-background',
							side?.code === 'L' ? 'right-0' : 'left-0',
						)}
					>
						{side.code}
					</small>
				{/if}
			</span>

			<a
				href="/player/{person.id}"
				class="line-clamp-1 grow break-all decoration-dashed group-hover/player:underline"
			>
				{player.lastInitName || person.fullName}
				<span class="absolute inset-0"></span>
			</a>

			{#if after}
				<span class="line-clamp-1 text-xs break-all text-current/50">{after}</span>
			{/if}
		{/if}
	</div>
{/snippet}
