<script lang="ts">
	import { page } from '$app/state'
	import { version } from '$pkg'
	import {
		ArrowsDiffIcon,
		CalendarIcon,
		CalendarTodayIcon,
		FlagIcon,
		HelmetIcon,
		JerseyIcon,
		JsonIcon,
		RankIcon,
		RobotIcon,
	} from '$ui/icons'
	import type { Component } from 'svelte'
	import Drawer from './drawer.svelte'
	import ToggleColorScheme from './toggle-color-scheme.svelte'

	const links: {
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
</script>

<Drawer>
	<div class="flex h-full flex-col gap-ch">
		<div class="sm:sidebar-closed-hidden">
			<a href="/"><strong>MLB</strong>.TheOhtani.com</a>
		</div>

		<ul class="sidebar-not-open:landscape:max-lg:overflow-clip [&_span]:sm:sidebar-closed-hidden">
			{#each links as { href, label, icon } (href)}
				<li>
					<a
						{href}
						class="relative flex items-center gap-1"
						class:active={page.route.id?.startsWith(href)}
					>
						<svelte:component this={icon} />
						<span>{label}</span>
					</a>
				</li>
			{/each}
		</ul>

		<ul class="mt-auto text-sm sm:sidebar-closed-hidden">
			<li><ToggleColorScheme /></li>
			<li>
				<a href="https://github.com/nuotsu/mlb"> View on GitHub </a>
			</li>
			<li><a href="https://nuotsu.dev">Built by nuotsu</a></li>
			<li>
				<small class="text-[xx-small] font-extralight text-current/50">
					@ {new Date().getFullYear()} MLB.TheOhtani.com. v{version}
				</small>
			</li>
		</ul>
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
