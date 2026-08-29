<script lang="ts">
	import { formatDate, getToday, slash } from '$lib/temporal'
	import { cn } from '$lib/utils'
	import { ChevronRightIcon } from '$ui/icons'
	import FavoriteTeamGames from './favorite-team-games.svelte'

	let {
		season,
		bordered,
		showFavoriteTeams,
	}: {
		season: MLB.SeasonDateInfo
		bordered?: boolean
		/** Adds a row per favorited team with today's game — homepage only */
		showFavoriteTeams?: boolean
	} = $props()
</script>

{#if season}
	<article class="space-y-ch">
		<h2 class="text-center h1">{season?.seasonId} Season Schedule</h2>

		<div class={cn(bordered && 'border border-stroke p-ch')}>
			<dl class="mx-auto description-list max-w-max tabular-nums">
				{#if season.seasonId === getToday().getFullYear().toString()}
					<dt>Today's games</dt>
					<dd class="inline-flex max-w-max items-center gap-[.5ch] positive link dark:text-accent">
						{@render linkedDate(formatDate(getToday(), { locale: 'en-CA' }), 'day')}
						<ChevronRightIcon class="size-[.8lh]" />
					</dd>

					{#if showFavoriteTeams}
						<FavoriteTeamGames />
					{/if}

					<hr class="col-span-full my-ch border-dashed border-stroke" />
				{/if}

				<dt>Spring Training</dt>
				<dd>
					{@render linkedDate(season.springStartDate)} - {@render linkedDate(season.springEndDate)}
				</dd>

				<dt>Regular Season</dt>
				<dd>
					{@render linkedDate(season.regularSeasonStartDate)}
					-
					{@render linkedDate(season.regularSeasonEndDate)}
				</dd>

				<dt>All-Star Game</dt>
				<dd>{@render linkedDate(season.allStarDate, 'day')}</dd>

				<dt>Postseason</dt>
				<dd>
					{@render linkedDate(season.postSeasonStartDate)}
					-
					{@render linkedDate(season.postSeasonEndDate)}
				</dd>
			</dl>
		</div>
	</article>
{/if}

{#snippet linkedDate(date: string = '', view: 'week' | 'day' = 'week')}
	{#if date}
		<a class="hover-link" href="/schedule/{view}/{date}">
			{formatDate(slash(date), { weekday: 'short', month: 'numeric', day: 'numeric' })}
		</a>
	{:else}
		<span>TBD</span>
	{/if}
{/snippet}
