<script lang="ts">
	import { descriptionChallenges, isAbsReview } from '#lib/abs.js'
	import { cn } from '#lib/utils.js'
	import Empty from '#ui/empty.svelte'
	import { favoritesStore } from '#ui/favorites/store.svelte.js'
	import Headshot from '#ui/player/headshot.svelte'
	import Logo from '#ui/team/logo.svelte'

	let {
		feedLive,
		onAtBatSelect,
	}: {
		feedLive: MLB.LiveGameFeed
		onAtBatSelect?: (atBatIndex: number) => void
	} = $props()

	type ReviewKind = 'ABS' | 'Play'
	type ReviewOutcome = 'Pending' | 'Overturned' | 'Stands'
	type ChallengeFate = 'retained' | 'lost'

	type ReviewItem = {
		key: string
		atBatIndex: number
		player?: MLB.Person
		team?: MLB.Team
		kind: ReviewKind
		outcome: ReviewOutcome
		fate?: ChallengeFate
		count?: string
		inning: string
	}

	function formatInning(about: MLB.PlayAbout): string {
		return `${about.isTopInning ? 'Top' : 'Bot'} ${about.inning}`
	}

	function formatOutcome(details: MLB.ReviewDetails): ReviewOutcome {
		if (details.inProgress && details.isOverturned == null) return 'Pending'
		return details.isOverturned ? 'Overturned' : 'Stands'
	}

	/** Color by whether the challenging side keeps or spends a challenge — not call result alone. */
	function challengeFate(
		details: MLB.ReviewDetails,
		hasChallenger: boolean,
	): ChallengeFate | undefined {
		if (!hasChallenger) return undefined
		if (details.inProgress && details.isOverturned == null) return undefined
		if (details.isOverturned == null) return undefined
		return details.isOverturned ? 'retained' : 'lost'
	}

	function fateFromOutcome(
		outcome: ReviewOutcome,
		hasChallenger: boolean,
	): ChallengeFate | undefined {
		if (!hasChallenger || outcome === 'Pending') return undefined
		return outcome === 'Overturned' ? 'retained' : 'lost'
	}

	function formatCount(count?: MLB.Count): string | undefined {
		if (count?.balls == null || count?.strikes == null) return undefined
		return `${count.balls}-${count.strikes}`
	}

	function resolvePlayer(person?: MLB.Person): MLB.Person | undefined {
		if (!person?.id) return undefined
		return (
			(feedLive.gameData.players[`ID${person.id}`] as unknown as MLB.Person | undefined) ?? person
		)
	}

	function resolvePlayerByName(name: string, play: MLB.Play): MLB.Person | undefined {
		const normalized = name.trim().toLowerCase()
		const candidates = [play.matchup?.batter, play.matchup?.pitcher].filter(Boolean) as MLB.Person[]

		for (const candidate of candidates) {
			if (candidate.fullName?.toLowerCase() === normalized) return resolvePlayer(candidate)
		}

		for (const entry of Object.values(feedLive.gameData.players ?? {})) {
			const person = (entry as unknown as MLB.Person).fullName
				? (entry as unknown as MLB.Person)
				: ((entry as MLB.PlayerGameData).person as MLB.Person | undefined)
			if (person?.fullName?.toLowerCase() === normalized) return resolvePlayer(person)
		}
	}

	function resolveTeam(challengeTeamId?: number, name?: string): MLB.Team | undefined {
		const { away, home } = feedLive.gameData.teams

		if (challengeTeamId != null) {
			if (challengeTeamId === away.id) return away
			if (challengeTeamId === home.id) return home
		}

		const match = name?.trim().toLowerCase()
		if (!match) return undefined

		return [away, home].find((team) =>
			[team.name, team.teamName, team.clubName, team.locationName, team.abbreviation]
				.filter(Boolean)
				.some((value) => value!.toLowerCase() === match || match.includes(value!.toLowerCase())),
		)
	}

	function lastPitchCount(play: MLB.Play): MLB.Count | undefined {
		const pitches = (play.playEvents ?? []).filter(
			(event) => event.isPitch || event.type === 'pitch',
		)
		return pitches.at(-1)?.count ?? play.count
	}

	const reviews = $derived.by(() => {
		const items: ReviewItem[] = []

		for (const play of feedLive.liveData.plays.allPlays ?? []) {
			const atBatIndex = play.atBatIndex ?? play.about.atBatIndex
			const inning = formatInning(play.about)
			const events = play.playEvents ?? []

			for (let i = 0; i < events.length; i++) {
				const event = events[i]
				const details = event?.reviewDetails
				if (!details) continue

				const player = resolvePlayer(details.player)
				const team = player
					? undefined
					: resolveTeam(details.challengeTeamId, event.details?.description)
				const hasChallenger = !!(player || team || details.challengeTeamId)

				items.push({
					key: `${atBatIndex}-${event.index ?? i}`,
					atBatIndex: play.about.atBatIndex,
					player,
					team,
					kind: isAbsReview(details) ? 'ABS' : 'Play',
					outcome: formatOutcome(details),
					fate: challengeFate(details, hasChallenger),
					count: formatCount(event.count),
					inning,
				})
			}

			let descIndex = 0
			for (const challenge of descriptionChallenges(play.result?.description)) {
				const challengerName = challenge.challenger
				const kind: ReviewKind = challenge.isAbs ? 'ABS' : 'Play'
				const outcome: ReviewOutcome = challenge.isOverturned ? 'Overturned' : 'Stands'
				const player = resolvePlayerByName(challengerName, play)
				const team = player ? undefined : resolveTeam(undefined, challengerName)
				const hasChallenger = !!(player || team)

				items.push({
					key: `${atBatIndex}-desc-${descIndex++}`,
					atBatIndex: play.about.atBatIndex,
					player,
					team,
					kind,
					outcome,
					fate: fateFromOutcome(outcome, hasChallenger),
					count: formatCount(lastPitchCount(play)),
					inning,
				})
			}
		}

		return items
	})
</script>

<article id="reviews" class="max-w-max space-y-ch has-data-empty:hidden">
	<h2 class="text-xs text-current/40">Reviews</h2>

	<dl class="grid gap-[.5ch]">
		{#each reviews as review (review.key)}
			{@const { atBatIndex, player, team, kind, outcome, fate, count, inning } = review}
			{@const label =
				player?.boxscoreName ??
				player?.lastName ??
				player?.fullName ??
				team?.abbreviation ??
				team?.teamName ??
				'Review'}

			<div
				class={cn(
					'relative flex items-center gap-ch',
					player &&
						favoritesStore.has(`/player/${player.id}`) &&
						'bg-accent text-dark [box-shadow:-.25ch_0_0_var(--color-accent),.25ch_0_0_var(--color-accent)]',
				)}
			>
				<dt class="flex shrink-0 items-center gap-ch">
					{#if player}
						<Headshot person={player} class="size-lh" />
					{:else if team}
						<Logo class="size-lh" {team} />
					{:else}
						<span class="size-lh shrink-0" aria-hidden="true"></span>
					{/if}

					{#if player}
						<a
							class="line-clamp-1 min-w-[10ch] break-all decoration-dashed hover:underline"
							href="/player/{player.id}"
							title={player.fullName}
						>
							{label}

							<span class="absolute inset-0"></span>
						</a>
					{:else}
						<span class="line-clamp-1 min-w-[10ch] break-all">{label}</span>
					{/if}
				</dt>

				<!-- Above the player link's overlay, so it picks the at-bat instead -->
				<dd class="relative grow self-stretch">
					<button
						type="button"
						class="flex size-full cursor-pointer items-center gap-ch text-left hover:bg-foreground/5"
						title="Show this at-bat"
						onclick={() => onAtBatSelect?.(atBatIndex)}
					>
						<span class="flex flex-wrap items-center gap-x-[.5ch] leading-none tabular-nums">
							<span class="text-xs text-current/40">{kind}</span>
							<span class="text-current/40">·</span>
							<span class={cn(fate === 'retained' && 'positive', fate === 'lost' && 'negative')}
								>{outcome}</span
							>
							{#if count}
								<span class="text-current/40">·</span>
								<span class="text-xs text-current/40">{count}</span>
							{/if}
						</span>

						<span class="ml-auto shrink-0 text-xs leading-none text-current/40 tabular-nums"
							>{inning}</span
						>
					</button>
				</dd>
			</div>
		{:else}
			<Empty data-empty>No reviews</Empty>
		{/each}
	</dl>
</article>
