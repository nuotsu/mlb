<script lang="ts">
	import { page } from '$app/state'
	import { formatDate, getToday } from '$lib/temporal'
	import { CalendarIcon, CalendarTodayIcon, JsonIcon } from '$ui/icons'
	import type { Component } from 'svelte'
	import Drawer from './drawer.svelte'
	import ToggleColorScheme from './toggle-color-scheme.svelte'

	const today = formatDate(getToday(), {
		locale: 'en-CA',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
	})

	const links: {
		href: string
		label: string
		icon: Component
	}[] = [
		{
			href: '/schedule',
			label: 'Weekly Schedule',
			icon: CalendarIcon,
		},
		{
			href: `/schedule/${today}`,
			label: "Today's Games",
			icon: CalendarTodayIcon,
		},
		{
			href: '/api/playground',
			label: 'Stats API Playground',
			icon: JsonIcon,
		},
	]
</script>

<Drawer>
	<div class="flex h-full flex-col gap-ch">
		<div class="sm:sidebar-closed-hidden">
			<a href="/"> MLB.TheOhtani.com </a>
		</div>

		<ul class="sidebar-not-open:landscape:max-lg:overflow-clip [&_span]:sm:sidebar-closed-hidden">
			{#each links as { href, label, icon }}
				<li>
					<a
						{href}
						class="relative flex items-center gap-1"
						class:active={page.url.pathname === href}
					>
						<svelte:component this={icon} />
						<span>{label}</span>
					</a>
				</li>
			{/each}
		</ul>

		<ul class="mt-auto text-sm sm:sidebar-closed-hidden">
			<li><ToggleColorScheme /></li>
			<li><a href="https://github.com/nuotsu/mlb">View on GitHub</a></li>
			<li><a href="https://nuotsu.dev">Built by nuotsu</a></li>
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
