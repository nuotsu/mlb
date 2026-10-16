<script lang="ts">
	import { formatDate } from '#lib/temporal.js'
	import { cn } from '#lib/utils.js'
	import { CalendarTodayIcon, ChevronLeftIcon, ChevronRightIcon } from '#ui/icons/index.js'
	import Loading from '#ui/loading.svelte'
	import { goto } from '$app/navigation'
	import { navigating, page } from '$app/state'
	import { teamSeasonSearchParams, withSearch } from './season'

	let {
		team,
		season,
		date,
		today,
		class: className,
	}: {
		team: MLB.Team
		season: number
		/** The day the page is read as of (YYYY-MM-DD) */
		date: string
		/** YYYY-MM-DD */
		today: string
		class?: string
	} = $props()

	const MIN_SEASON = 1876

	const currentSeason = $derived(Number(today.slice(0, 4)))
	/** A season from before the club's first year can still come in through the URL */
	const firstSeason = $derived(
		Math.min(season, Math.max(MIN_SEASON, Number(team.firstYearOfPlay) || MIN_SEASON)),
	)

	/** Leaving out the date lets the server pick the season's default day */
	function href(nextSeason: number, nextDate?: string) {
		return withSearch(
			page.url.pathname,
			teamSeasonSearchParams(
				new URLSearchParams(page.url.search),
				{ season: nextSeason, date: nextDate },
				today,
			),
		)
	}

	function go(search: string) {
		goto(search, { reset: false })
	}

	const isLoading = $derived(
		navigating.to?.route.id === page.route.id && navigating.to?.url.pathname === page.url.pathname,
	)
</script>

<fieldset
	class={cn('flex flex-col items-center gap-[.5ch] text-center', className)}
	data-sveltekit-reset="false"
>
	<div class="flex justify-center gap-px">
		<a class="button" href={href(currentSeason)} title="Current season">
			<CalendarTodayIcon value={currentSeason % 100} />
		</a>

		<select
			class="button min-w-[8ch] text-center"
			aria-label="Season"
			value={season}
			onchange={(e) => go(href(Number(e.currentTarget.value)))}
		>
			{#each { length: currentSeason - firstSeason + 1 } as _, i (i)}
				{@const year = currentSeason - i}
				<option value={year}>{year}</option>
			{/each}
		</select>

		<a
			class={cn(
				'order-first button border-b-0 border-l',
				season <= firstSeason && 'pointer-events-none opacity-50',
			)}
			href={href(season - 1)}
			aria-label="Previous season"
		>
			<ChevronLeftIcon />
		</a>
		<a
			class={cn(
				'order-last button border-r border-b-0',
				season >= currentSeason && 'pointer-events-none opacity-50',
			)}
			href={href(season + 1)}
			aria-label="Next season"
		>
			<ChevronRightIcon />
		</a>
	</div>

	<div class="flex items-center gap-ch text-sm">
		<label class="text-current/60 decoration-dashed hover:underline">
			<span class="text-current/40">As of</span>
			{formatDate(date, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}

			<input
				class="sr-only"
				type="date"
				aria-label="As of date"
				min="{season}-01-01"
				max={season === currentSeason ? today : `${season}-12-31`}
				value={date}
				onclick={(e) => e.currentTarget.showPicker?.()}
				onchange={(e) => e.currentTarget.value && go(href(season, e.currentTarget.value))}
			/>
		</label>

		{#if isLoading}
			<Loading class="text-current/40" aria-label="Loading season" />
		{/if}
	</div>
</fieldset>
