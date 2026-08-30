<script lang="ts">
	import { page } from '$app/state'
	import { version } from '$pkg'
	import {
		ArrowsDiffIcon,
		BatIcon,
		CalendarIcon,
		CalendarTodayIcon,
		FlagIcon,
		GithubIcon,
		HelmetIcon,
		JerseyIcon,
		JsonIcon,
		MegaphoneIcon,
		RankIcon,
	} from '$ui/icons'
	import type { Component } from 'svelte'
	import CompareList from './compare-list.svelte'
	import Drawer from './drawer.svelte'
	import FavoritesList from './favorites-list.svelte'
	import GameCount from './game-count.svelte'
	import SpoilerPreventionList from './spoiler-prevention-list.svelte'
	import ToggleColorScheme from './toggle-color-scheme.svelte'

	type LinkItem = {
		href: string
		label: string
		icon: Component
	}

	const internalLinks: Record<string, LinkItem[]> = {
		Schedule: [
			{
				href: '/schedule/day',
				label: 'Daily Schedule',
				icon: CalendarTodayIcon,
			},
			{
				href: '/schedule/week',
				label: 'Weekly Schedule',
				icon: CalendarIcon,
			},
		],
		League: [
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
				href: '/team-stats',
				label: 'Team Stats',
				icon: BatIcon,
			},
		],
		Browse: [
			{
				href: '/teams',
				label: 'Teams',
				icon: JerseyIcon,
			},
			{
				href: '/player',
				label: 'Players',
				icon: HelmetIcon,
			},
			{
				href: '/transactions',
				label: 'Transactions',
				icon: ArrowsDiffIcon,
			},
			{
				href: '/blog',
				label: 'Blog',
				icon: MegaphoneIcon,
			},
		],
		Developer: [
			{
				href: '/api/v1',
				label: 'Stats API Playground',
				icon: JsonIcon,
			},
		],
	}
</script>

<Drawer>
	<div class="flex h-full flex-col overflow-x-clip overflow-y-auto pt-ch sidebar-open:gap-ch">
		<div class="mb-ch sm:sidebar-closed-hidden">
			<a class="flex items-center gap-ch" href="/">
				<figure class="relative size-4">
					<img
						class="absolute top-1/2 left-1/2 size-lh min-w-max -translate-1/2 rounded object-cover"
						src="/favicons/favicon-48x48.png"
						alt=""
						width={48}
						height={48}
						loading="eager"
						draggable="false"
					/>
				</figure>
				<div>
					<strong>MLB</strong><small>.TheOhtani.com</small>
				</div>
			</a>
		</div>

		{#each Object.entries(internalLinks) as [group, links] (group)}
			<div class="grid gap-[.5ch]">
				{#if links.length >= 1}
					<h2
						class="text-[x-small] tracking-widest text-current/50 uppercase sm:sidebar-not-open:hidden"
					>
						{group}
					</h2>
				{/if}
				<ul class="sidebar-not-open:landscape:max-lg:overflow-clip">
					{#each links as link (link.href)}
						{@render navLink(link)}
					{/each}
				</ul>
			</div>
		{/each}

		<ul class="mt-auto text-sm *:py-[2px] sidebar-not-open:landscape:max-lg:overflow-clip">
			<li><CompareList /></li>
			<li><FavoritesList /></li>
			<li><SpoilerPreventionList /></li>
		</ul>

		<div
			class="flex items-center justify-between gap-ch border-t border-stroke/50 pt-ch pr-ch pb-[max(1ch,env(safe-area-inset-bottom))] pl-[max(1ch,env(safe-area-inset-left))]"
		>
			<ToggleColorScheme />

			<a
				class="flex flex-row-reverse items-center gap-[.5ch] sidebar-not-open:hidden"
				href="https://github.com/nuotsu/mlb"
			>
				<GithubIcon />
				<small class="text-[x-small] text-current/50 tabular-nums">v{version}</small>
			</a>
		</div>
	</div>
</Drawer>

{#snippet navLink({ class: className, href, label, icon: Icon }: LinkItem & { class?: string })}
	<li class={className}>
		<a
			{href}
			class="group/link relative flex items-center gap-ch py-px"
			class:active={page.route.id?.startsWith(href)}
		>
			<Icon />

			<span class="grow decoration-dashed group-hover/link:underline sm:sidebar-closed-hidden">
				{label}
			</span>

			{#if href === '/schedule/day'}
				<GameCount />
			{:else if label.includes('WBC')}
				<GameCount sportId="51" />
			{/if}
		</a>
	</li>
{/snippet}

<style>
	div :global(svg) {
		flex-shrink: 0;
		width: 1rem;
		height: 1rem;
	}

	h2,
	a:not([href*='github']),
	li > :global(*) {
		padding-inline: max(1ch, env(safe-area-inset-left)) 1ch;
	}

	.active::before {
		content: '';
		position: absolute;
		inset: 50% auto auto 0;
		translate: -50% -50%;
		width: 0.5ch;
		aspect-ratio: 1;
		border-radius: 100%;
		background-color: var(--color-accent);
	}
</style>
