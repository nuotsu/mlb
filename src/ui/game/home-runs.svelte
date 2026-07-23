<script lang="ts">
	import { cn } from '$lib/utils'
	import Empty from '$ui/empty.svelte'
	import { favoritesStore } from '$ui/favorites/store.svelte'
	import Headshot from '$ui/player/headshot.svelte'

	let { feedLive }: { feedLive: MLB.LiveGameFeed } = $props()

	const RBI_LABELS = {
		1: 'Solo',
		2: '2-Run',
		3: '3-Run',
		4: 'Grand Slam',
	} as const

	const DIRECTION_FROM_DESC: [RegExp, string][] = [
		[/left center\s+field/i, 'LCF'],
		[/right center\s+field/i, 'RCF'],
		[/left\s+field/i, 'LF'],
		[/right\s+field/i, 'RF'],
		[/center\s+field/i, 'CF'],
	]

	function getHitData(play: MLB.Play): MLB.HitData | undefined {
		return play.playEvents?.find((event) => event.hitData)?.hitData
	}

	function parseSeasonOrdinal(description?: string): number | undefined {
		const match = description?.match(/homers?\s*\((\d+)\)/i)
		return match ? Number(match[1]) : undefined
	}

	function directionFromCoordX(coordX?: number): string | undefined {
		if (coordX == null) return undefined
		if (coordX < 45) return 'LF'
		if (coordX < 90) return 'LCF'
		if (coordX < 160) return 'CF'
		if (coordX < 215) return 'RCF'
		return 'RF'
	}

	function parseDirection(description?: string, hitData?: MLB.HitData): string | undefined {
		if (description) {
			for (const [pattern, label] of DIRECTION_FROM_DESC) {
				if (pattern.test(description)) return label
			}
		}
		return directionFromCoordX(hitData?.coordinates?.coordX)
	}

	function formatInning(about: MLB.PlayAbout): string {
		return `${about.isTopInning ? 'Top' : 'Bot'} ${about.inning}`
	}

	function formatHitMetrics(hitData?: MLB.HitData): string | undefined {
		const parts = [
			hitData?.totalDistance != null ? `${Math.round(hitData.totalDistance)} ft` : undefined,
			hitData?.launchSpeed != null ? `${hitData.launchSpeed} mph` : undefined,
			hitData?.launchAngle != null ? `${Math.round(hitData.launchAngle)}°` : undefined,
		].filter(Boolean)

		return parts.length ? parts.join(' / ') : undefined
	}

	const homeRuns = $derived(
		(feedLive.liveData.plays.allPlays ?? [])
			.filter((play) => play.result?.eventType === 'home_run')
			.map((play) => {
				const hitData = getHitData(play)
				const batter = play.matchup.batter
				const player =
					(feedLive.gameData.players[`ID${batter.id}`] as unknown as MLB.Person | undefined) ??
					batter

				return {
					atBatIndex: play.atBatIndex,
					player,
					ordinal: parseSeasonOrdinal(play.result.description),
					rbiLabel: RBI_LABELS[play.result.rbi as keyof typeof RBI_LABELS],
					inning: formatInning(play.about),
					hitMetrics: formatHitMetrics(hitData),
					direction: parseDirection(play.result.description, hitData),
				}
			}),
	)
</script>

<article class="max-w-max space-y-ch has-data-empty:hidden">
	<h2 class="text-xs text-current/40">Homeruns</h2>

	<dl class="grid gap-[.5ch]">
		{#each homeRuns as hr (hr.atBatIndex)}
			{@const { player, ordinal, rbiLabel, inning, hitMetrics, direction } = hr}

			<div
				class={cn(
					'group/player relative flex items-center gap-ch',
					favoritesStore.has(`/player/${player.id}`) &&
						'bg-accent text-dark [box-shadow:-.25ch_0_0_var(--color-accent),.25ch_0_0_var(--color-accent)]',
				)}
			>
				<dt class="flex shrink-0 items-center gap-ch">
					<Headshot person={player} class="size-lh" />

					<a
						class="line-clamp-1 min-w-[10ch] break-all decoration-dashed group-hover/player:underline"
						href="/player/{player.id}"
						title={player.fullName}
					>
						{player.boxscoreName ?? player.lastName ?? player.fullName}

						<span class="absolute inset-0"></span>
					</a>
				</dt>

				<dd class="flex flex-wrap items-center gap-x-[.5ch] leading-none tabular-nums">
					{#if ordinal != null}
						<span>#{ordinal}</span>
					{/if}
					{#if rbiLabel}
						<span class="text-xs text-current/40">({rbiLabel})</span>
					{/if}
					{#if (ordinal != null || rbiLabel) && hitMetrics}
						<span class="text-current/40">·</span>
					{/if}
					{#if hitMetrics}
						<span>{hitMetrics}</span>
					{/if}
					{#if direction}
						<span class="text-xs text-current/40">({direction})</span>
					{/if}
				</dd>

				<span class="ml-auto shrink-0 text-xs leading-none text-current/40 tabular-nums"
					>{inning}</span
				>
			</div>
		{:else}
			<Empty data-empty>No homeruns</Empty>
		{/each}
	</dl>
</article>
