<script lang="ts">
	import { page } from '$app/state'
	import { version } from '$pkg'
	import {
		ArrowsDiffIcon,
		CalendarIcon,
		CalendarTodayIcon,
		CodeIcon,
		FlagIcon,
		GithubIcon,
		HelmetIcon,
		JerseyIcon,
		JsonIcon,
		RankIcon,
		RobotIcon,
	} from '$ui/icons'
	import type { Component } from 'svelte'
	import Drawer from './drawer.svelte'
	import FavoritesList from './favorites-list.svelte'
	import SpoilerPreventionList from './spoiler-prevention-list.svelte'
	import ToggleColorScheme from './toggle-color-scheme.svelte'

	const internalLinks: {
		href: string
		label: string
		icon: Component
	}[] = [
		{
			href: '/schedule/week',
			label: 'Weekly Schedule',
			icon: CalendarIcon,
		},
		{
			href: '/schedule/day',
			label: 'Daily Schedule',
			icon: CalendarTodayIcon,
		},
		{
			href: '/standings',
			label: 'Standings',
			icon: FlagIcon,
		},
		{
			href: '/stats',
			label: 'Stat Leaders',
			icon: RankIcon,
		},
		{
			href: '/teams',
			label: 'Teams',
			icon: JerseyIcon,
		},
		{
			href: '/player',
			label: 'Player',
			icon: HelmetIcon,
		},
		{
			href: '/transactions',
			label: 'Transactions',
			icon: ArrowsDiffIcon,
		},
		// {
		// 	href: '/chat',
		// 	label: 'Ask Mitch',
		// 	icon: RobotIcon,
		// },
		{
			href: '/api/v1',
			label: 'Stats API Playground',
			icon: JsonIcon,
		},
	]

	const externalLinks: {
		href: string
		label: string
		icon: Component
	}[] = [
		{
			href: 'https://github.com/nuotsu/mlb',
			label: 'View on GitHub',
			icon: GithubIcon,
		},
		{
			href: 'https://nuotsu.dev',
			label: 'Built by nuotsu',
			icon: CodeIcon,
		},
	]
</script>

<Drawer>
	<div class="flex h-full flex-col gap-ch">
		<div class="sm:sidebar-closed-hidden">
			<a href="/"><strong>MLB</strong>.TheOhtani.com</a>
		</div>

		<ul class="sidebar-not-open:landscape:max-lg:overflow-clip">
			{#each internalLinks as { href, label, icon } (href)}
				<li>
					<a
						{href}
						class="relative flex items-center gap-ch hover-link"
						class:active={page.route.id?.startsWith(href)}
					>
						<svelte:component this={icon} />
						<span class="sm:sidebar-closed-hidden">{label}</span>
					</a>
				</li>
			{/each}
		</ul>

		<ul class="mt-auto text-sm">
			<li><FavoritesList /></li>
			<li><SpoilerPreventionList /></li>
			<li><ToggleColorScheme /></li>
			{#each externalLinks as { href, label, icon } (href)}
				<li class="sm:sidebar-not-open:hidden">
					<a class="flex items-center gap-ch hover-link" {href}>
						<svelte:component this={icon} />
						<span>{label}</span>
					</a>
				</li>
			{/each}
		</ul>

		<small
			class="font-semilight text-center text-[xx-small] text-current/50 sm:sidebar-not-open:hidden"
		>
			@ {new Date().getFullYear()} MLB.TheOhtani.com.
			<span class="tabular-nums">v{version}</span>
		</small>
	</div>
</Drawer>

<style>
	div :global(svg) {
		flex-shrink: 0;
		width: 1em;
		height: 1em;
	}

	.active::before {
		content: '';
		position: absolute;
		inset: 50% auto auto -1ch;
		translate: -50% -50%;
		width: 0.5ch;
		aspect-ratio: 1;
		border-radius: 100%;
		background-color: var(--color-accent);
	}
</style>
