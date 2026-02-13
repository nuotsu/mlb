<script lang="ts">
	import { formatDate, slash } from '$lib/temporal'
	import ChevronRight from '$ui/icons/chevron-right.svelte'
	import Logo from '$ui/team/logo.svelte'

	let { rosterEntries }: { rosterEntries: MLB.Roster[] } = $props()

	function format(date: string) {
		return [
			formatDate(slash(date), { month: 'short' }),
			"'" + formatDate(slash(date), { year: '2-digit' }),
		].join(' ')
	}
</script>

<ol class="mx-auto flex max-w-max gap-ch overflow-x-auto px-ch pt-[.5lh]">
	{#each rosterEntries.filter((entry) => !entry.team.parentOrgId) as { jerseyNumber, team, isActive, startDate, endDate } (team.id)}
		{@const src = `https://midfield.mlbstatic.com/v1/team/${team.id}/spots`}
		{@const startDateFormatted = startDate ? format(startDate) : undefined}
		{@const endDateFormatted = endDate ? format(endDate) : undefined}

		<li class="relative flex shrink-0 flex-col items-center">
			{#if isActive}
				<ChevronRight
					class="absolute bottom-full left-1/2 size-[.6lh] -translate-x-1/2 rotate-90 text-accent"
				/>
			{/if}

			<a href="/teams/{team.id}" class="shrink-0" aria-label={team.name}>
				<Logo srcset="{src}/96" class="size-[2lh] object-contain" {team} title={team.name} />
			</a>

			<span class="not-empty:before:content-['#']" data-jersey>{jerseyNumber}</span>

			<time class="text-xs text-current/50" datetime={startDate}>
				{startDateFormatted}
			</time>

			{#if endDate && startDateFormatted !== endDateFormatted}
				<time class="text-xs text-current/50" datetime={endDate}>
					- {endDateFormatted}
				</time>
			{/if}
		</li>
	{/each}
</ol>

<style>
	ol:has([data-jersey]:not(:empty)) [data-jersey] {
		min-height: 1lh;
	}
</style>
