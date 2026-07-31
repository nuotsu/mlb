<script lang="ts">
	import { fetchMLB } from '$lib/fetch'
	import Awards from '$ui/banner/awards.svelte'
	import Baseball from '$ui/baseball.svelte'
	import Rollup from '$ui/blog/rollup.svelte'
	import { favoritesStore } from '$ui/favorites/store.svelte'
	import { ChevronRightIcon, StarEmptyIcon } from '$ui/icons'
	import Metadata from '$ui/metadata.svelte'
	import QuickSearch from '$ui/quick-search.svelte'
	import Calendar from '$ui/schedule/calendar.svelte'
	import CountdownList from '$ui/season/countdown-list.svelte'
	import SeasonInfo from '$ui/season/season-info.svelte'
	import TeamCalendar from '$ui/team/team-calendar.svelte'
	import TransactionByTeam from '$ui/transactions/by-team.svelte'
	import type { PageProps } from './$types'

	let { data }: PageProps = $props()
	let { season } = $derived(data)

	const ascii = `$$\\      $$\\ $$\\       $$$$$$$\\
$$$\\    $$$ |$$ |      $$  __$$\\
$$$$\\  $$$$ |$$ |      $$ |  $$ |
$$\\$$\\$$ $$ |$$ |      $$$$$$$\\ |
$$ \\$$$  $$ |$$ |      $$  __$$\\
$$ |\\$  /$$ |$$ |      $$ |  $$ |
$$ | \\_/ $$ |$$$$$$$$\\ $$$$$$$  |
\\__|     \\__|\\________|\\_______/
`

	const favoriteTeam = favoritesStore.favorites
		.find((f) => f.href.includes('team'))
		?.href.split('/')
		.pop()

	async function fetchFavoriteTeam() {
		const {
			teams: [team],
		} = await fetchMLB<MLB.TeamsResponse>(`/api/v1/teams/${favoriteTeam}`, {
			fields: ['teams,id,name,abbreviation,sport'],
		})

		return team
	}
</script>

<Metadata
	title="MLB.TheOhtani.com"
	description="A custom MLB scorebug for Major League Baseball (MLB) and other leagues. MLB = Mitchell's Live scoreBug."
/>

<div
	class="flex min-h-[calc(100dvh-1ch)] flex-col justify-center gap-[2lh] pt-[2lh] pb-[max(2lh,env(safe-area-inset-bottom))]"
>
	<div class="my-auto flex flex-col gap-[inherit] px-ch">
		<header class="space-y-ch">
			<h1 class="mx-auto flex max-w-max flex-col text-xl" aria-label="Welcome to MLB.TheOhtani.com">
				<div class="mb-1">Welcome to</div>
				<pre
					class="-mt-ch overflow-x-auto overflow-y-clip text-[x-small] leading-none">{ascii}</pre>
				<p class="ml-auto">.TheOhtani.com</p>
			</h1>

			<p class="text-center text-balance italic [&_a]:decoration-dashed [&_a:hover]:underline">
				<a href="/schedule/day">Track MLB games</a>, <a href="/stats">explore stats</a>, and
				<a href="/api/v1">query the Stats API</a>, all in one app.
			</p>

			<Baseball class="mx-auto my-[-5lh] mb-[-8lh] w-[300px] text-[8px]" />

			<QuickSearch class="mx-auto mt-lh! w-full max-w-sm" />
		</header>

		<hr class="border-dashed border-stroke" />

		{#if season}
			<CountdownList {season} />
		{/if}

		<div
			class="grid items-start gap-x-lh gap-y-[2lh] sm:grid-cols-[repeat(auto-fit,minmax(var(--container-xs),1fr))]"
			style:--height="30ch"
		>
			{#if season}
				<SeasonInfo {season} bordered />
			{/if}

			<section class="space-y-ch">
				{#if favoriteTeam}
					{#await fetchFavoriteTeam() then team}
						<h2 class="text-center h1">{team.name} Schedule</h2>
						<TeamCalendar class="border-t border-stroke" {team} />
						<div class="text-center text-sm">
							{@render link({ href: `/teams/${favoriteTeam}`, label: 'View team' })}
						</div>
					{/await}
				{:else}
					<h2 class="text-center h1">Calendar</h2>
					<Calendar class="border-t border-stroke" />
					<div
						class="flex items-center justify-center gap-[.5ch] text-center text-sm text-current/50"
					>
						<StarEmptyIcon class="size-lh shrink-0" />
						<p class="text-left">
							<a class="link" href="/teams">Favorite a team</a> to view their schedule.
						</p>
					</div>
				{/if}
			</section>

			<section class="space-y-ch [&_ul_p]:text-sm">
				<h2 class="text-center h1">Today's Transactions</h2>
				<TransactionByTeam transactions={data.transactions?.transactions ?? []} />
				<div class="text-center text-sm">
					{@render link({ href: '/transactions', label: 'View all transactions' })}
				</div>
			</section>

			<section class="space-y-ch">
				<h2 class="text-center h1">Blog</h2>
				<Rollup
					posts={data.posts}
					class="h-[calc(var(--height)+1.5lh+3px)] overflow-y-auto border border-stroke p-ch [&_time]:text-sm"
					limit={10}
				/>
				<div class="text-center text-sm">
					{@render link({ href: `/blog`, label: 'View all posts' })}
				</div>
			</section>
		</div>
	</div>

	<Awards />
</div>

{#snippet link({ href, label }: { href: string; label: string })}
	<div class="text-center text-sm">
		<a {href} class="inline-flex h-rlh items-center gap-[.5ch] hover-link hover:text-current">
			{label}
			<ChevronRightIcon class="size-lh" />
		</a>
	</div>
{/snippet}

<style>
	section :global(table) {
		position: relative;

		&::after {
			content: '';
			pointer-events: none;
			position: absolute;
			inset: 0;
			border: 1px solid var(--color-stroke);
			border-top: none;
		}
	}
</style>
