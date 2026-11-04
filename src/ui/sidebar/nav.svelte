<script lang="ts">
	import { appIconSrc } from '#lib/app-icon.js'
	import { version } from '#pkg'
	import { appIconStore } from '#ui/app-icon/store.svelte.js'
	import {
		ArrowsDiffIcon,
		BatIcon,
		CalendarIcon,
		CalendarTodayIcon,
		GithubIcon,
		HelmetIcon,
		JerseyIcon,
		JsonIcon,
		MegaphoneIcon,
		MvpIcon,
		RankIcon,
		StrikezoneIcon,
		TrophyIcon,
	} from '#ui/icons/index.js'
	import { page } from '$app/state'
	import type { Component } from 'svelte'
	import Account from './account.svelte'
	import CompareList from './compare-list.svelte'
	import Drawer from './drawer.svelte'
	import GameCount from './game-count.svelte'
	import ToggleColorScheme from './toggle-color-scheme.svelte'

	// The chosen app icon only exists in the browser; swap it in after hydration
	let mounted = $state(false)
	$effect(() => {
		mounted = true
	})
	let logoSrc = $derived(appIconSrc(mounted ? appIconStore.icon : 'default', 'favicon-48x48.png'))

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
				icon: RankIcon,
			},
			{
				href: '/postseason',
				label: 'Postseason',
				icon: TrophyIcon,
			},
			{
				href: '/stats',
				label: 'Stat Leaders',
				icon: MvpIcon,
			},
			{
				href: '/team-stats',
				label: 'Team Stats',
				icon: BatIcon,
			},
			{
				href: '/abs',
				label: 'ABS Challenges',
				icon: StrikezoneIcon,
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
	<div
		class="relative no-scrollbar flex h-full flex-col overflow-x-clip overflow-y-auto overscroll-y-contain pt-ch sidebar-open:gap-ch"
	>
		<div class="mb-ch sm:sidebar-closed-hidden">
			<a class="flex items-center gap-ch" href="/">
				<figure class="relative size-4">
					<img
						class="absolute top-1/2 left-1/2 size-lh min-w-max -translate-1/2 rounded object-cover"
						src={logoSrc}
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

		<span class="indicator" aria-hidden="true"></span>

		<ul class="mt-auto text-sm *:py-[2px] sidebar-not-open:landscape:max-lg:overflow-clip">
			<li><CompareList /></li>
		</ul>

		<!-- account | theme (centered) | version; stacked in the collapsed rail -->
		<div
			class="grid grid-cols-[1fr_auto_1fr] items-center gap-ch overflow-y-clip border-t border-stroke/50 pt-ch pr-ch pb-[max(1ch,env(safe-area-inset-bottom))] pl-[max(1ch,env(safe-area-inset-left))] sidebar-not-open:grid-cols-1 sidebar-not-open:*:col-start-auto"
		>
			<Account class="col-start-1 justify-self-start" />

			<div class="col-start-2 row-start-1 flex justify-center sidebar-not-open:row-start-auto">
				<ToggleColorScheme />
			</div>

			<a
				class="col-start-3 row-start-1 flex flex-row-reverse items-center gap-[.5ch] justify-self-end sidebar-not-open:hidden"
				href="https://github.com/nuotsu/mlb"
			>
				<GithubIcon />
				<small class="text-[x-small] text-current/50 tabular-nums">v{version}</small>
			</a>
		</div>
	</div>
</Drawer>

{#snippet navLink({ class: className, href, label, icon: Icon }: LinkItem & { class?: string })}
	{@const active = page.url.pathname.startsWith(href)}

	<li class={className}>
		<a {href} class="relative flex items-center gap-ch py-px" class:active>
			<Icon />

			<span class="grow sm:sidebar-closed-hidden">
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

	/* accent bar on the drawer edge, gliding to whichever link is active */
	.indicator {
		display: none;
		position: absolute;
		width: 3px;
		border-radius: 0 3px 3px 0;
		background-color: var(--color-accent);
		pointer-events: none;
	}

	@supports (anchor-name: --a) {
		.active {
			anchor-name: --active-nav-link;
		}

		.indicator {
			display: block;
			position-anchor: --active-nav-link;
			inset: calc(anchor(top) + 0.25ch) auto calc(anchor(bottom) + 0.25ch) 0;
			transition:
				inset 300ms ease-in-out,
				opacity 150ms;
		}

		div:not(:has(.active)) > .indicator {
			opacity: 0;
		}
	}

	.active {
		isolation: isolate;

		@supports not (anchor-name: --a) {
			&::before {
				content: '';
				position: absolute;
				inset: 0.25ch auto 0.25ch 0;
				width: 3px;
				border-radius: 0 3px 3px 0;
				background-color: var(--color-accent);
			}
		}

		/* inset pill, accent fading into a neutral tint */
		&::after {
			content: '';
			position: absolute;
			inset: 0 0.5ch;
			z-index: -1;
			border-radius: 0.5ch;
			background: linear-gradient(
				to right,
				color-mix(in srgb, var(--color-accent) 25%, transparent),
				color-mix(in srgb, var(--color-foreground) 3%, transparent)
			);
		}

		:global(svg) {
			color: var(--color-green-700);

			:global(html:has([data-color-scheme='dark'])) & {
				color: var(--color-accent);
			}
		}
	}
</style>
