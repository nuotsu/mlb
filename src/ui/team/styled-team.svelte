<script lang="ts">
	import { isDarkOnLightTeam, isLightOnDarkTeam } from '#lib/colors.js'
	import { usesNpbLogo } from '#lib/team-logos.js'
	import { cn } from '#lib/utils.js'
	import type { Snippet } from 'svelte'
	import Logo from './logo.svelte'

	let {
		team,
		class: className,
		linked,
		record,
		logo = true,
		children,
	}: {
		team: MLB.Team
		class?: string
		linked?: boolean
		record?: MLB.LeagueRecord
		/** Off when the logo has a (sticky) column of its own */
		logo?: boolean
		children?: Snippet
	} = $props()

	const src = $derived(`https://midfield.mlbstatic.com/v1/team/${team.id}/spots`)

	/** npb.jp's logo on white: no team color behind it, so the text keeps its own color too */
	const plain = $derived(usesNpbLogo(team.id))
</script>

<div
	class={cn(
		'group/team @container/team relative isolate flex items-center gap-[.5ch]',
		!plain && isDarkOnLightTeam(team) && 'dark:text-dark',
		!plain && isLightOnDarkTeam(team) && 'dark:text-light',
		className,
		// Over a caller's backdrop (e.g. the scoreboard's), so the row shows what's behind it
		plain && 'bg-transparent',
	)}
	style:--team-bg={plain ? undefined : `url('${src}/32')`}
>
	{#if logo}
		<Logo srcset="{src}/96" class="size-lh shrink-0 object-contain" {team} />
	{/if}

	<div
		class="line-clamp-1 break-all *:decoration-dashed group-has-[a:hover]/team:*:underline"
		data-name
	>
		<span class="@max-[24ch]/team:hidden">{team.name}</span>
		<span class="@max-[18ch]/team:hidden @min-[24ch]:hidden">{team.clubName}</span>
		<span class="@max-[14ch]/team:hidden @min-[18ch]:hidden">{team.teamName}</span>
		{#if team.abbreviation}
			<span class="@max-[8ch]/team:hidden @min-[14ch]/team:hidden">{team.abbreviation}</span>
		{/if}
	</div>

	{#if record}
		<small class="text-xs whitespace-nowrap text-current/50 @max-[12ch]/team:hidden">
			{record.wins}-{record.losses}
		</small>
	{/if}

	{@render children?.()}

	{#if linked}
		<!-- clipped: the label is only an accessible name, and it would otherwise wrap past the box -->
		<a href="/teams/{team.id}" class="absolute inset-0 overflow-clip text-transparent">
			{team.name}
		</a>
	{/if}
</div>
