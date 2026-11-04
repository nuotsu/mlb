<script module lang="ts">
	export const FAVORITES_LAYOUTS = ['tiles', 'list', 'chips'] as const
	export type FavoritesLayout = (typeof FAVORITES_LAYOUTS)[number]
</script>

<script lang="ts">
	import { cn } from '#lib/utils.js'
	import { favoritesStore } from '#ui/favorites/store.svelte.js'
	import { CloseIcon, StarIcon } from '#ui/icons/index.js'
	import Headshot from '#ui/player/headshot.svelte'
	import Logo from '#ui/team/logo.svelte'
	import { onMount } from 'svelte'

	let { layout = 'tiles' }: { layout?: FavoritesLayout } = $props()

	// Favorites live in localStorage; swap them in after hydration
	let mounted = $state(false)
	onMount(() => (mounted = true))

	let favorites = $derived(mounted ? favoritesStore.favorites : [])
	let groups = $derived(
		[
			{ label: 'Teams', items: favorites.filter(isTeam) },
			{ label: 'Players', items: favorites.filter((f) => !isTeam(f)) },
		].filter((g) => g.items.length),
	)

	function isTeam(favorite: App.Favorite) {
		return favorite.href.startsWith('/teams/')
	}

	function idOf(favorite: App.Favorite) {
		return Number(favorite.href.split('/').pop())
	}
</script>

<section class="space-y-ch">
	<header class="flex items-baseline justify-between gap-ch">
		<h2 class="h3">Favorites</h2>
		{#if favorites.length}
			<small class="text-xs text-current/60 tabular-nums">{favorites.length}</small>
		{/if}
	</header>

	{#if !favorites.length}
		<p class="text-sm text-current/60">
			Star a <a class="link" href="/teams">team</a> or <a class="link" href="/player">player</a> to keep
			them one tap away. Favorite teams' games are listed first on the schedule.
		</p>
	{:else if layout === 'tiles'}
		{#each groups as group (group.label)}
			<div class="space-y-[.5ch]">
				<h3 class="text-[x-small] tracking-widest text-current/50 uppercase">{group.label}</h3>
				<ul class="grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-[.5ch]">
					{#each group.items as favorite (favorite.href)}
						{@render tile(favorite)}
					{/each}
				</ul>
			</div>
		{/each}
	{:else if layout === 'list'}
		<ul class="divide-y divide-current/10 border-y border-current/10">
			{#each favorites as favorite (favorite.href)}
				<li class="flex min-h-11 items-center gap-ch py-[.5ch]">
					<a class="group/fav flex min-w-0 grow items-center gap-ch" href={favorite.href}>
						{@render image(favorite, 'size-8')}
						<div class="min-w-0">
							<p class="truncate text-sm decoration-dashed group-hover/fav:underline">
								{favorite.label}
							</p>
							<p class="text-xs text-current/60">{isTeam(favorite) ? 'Team' : 'Player'}</p>
						</div>
					</a>
					<button
						class="tap grid size-8 shrink-0 place-items-center text-accent transition-colors hover:text-current/50"
						onclick={() => favoritesStore.remove(favorite)}
						aria-label="Remove {favorite.label} from favorites"
						title="Remove from favorites"
					>
						<StarIcon class="size-lh" />
					</button>
				</li>
			{/each}
		</ul>
	{:else}
		<ul class="flex flex-wrap gap-[.5ch]">
			{#each favorites as favorite (favorite.href)}
				<li
					class="flex items-center rounded-full border border-current/25 transition-colors has-[a:hover]:border-accent"
				>
					<a
						class="flex items-center gap-[.5ch] py-[.25ch] pl-[.25ch] text-sm"
						href={favorite.href}
					>
						{@render image(favorite, 'size-6')}
						<span class="max-w-[16ch] truncate">{favorite.label}</span>
					</a>
					{@render remove(favorite, 'mx-[.25ch] size-6 rounded-full')}
				</li>
			{/each}
		</ul>
	{/if}
</section>

{#snippet image(favorite: App.Favorite, className: string)}
	{#if isTeam(favorite)}
		<Logo class={className} team={{ id: idOf(favorite), name: favorite.label } as MLB.Team} />
	{:else}
		<Headshot class={cn('shrink-0', className)} person={{ id: idOf(favorite) }} size={72} />
	{/if}
{/snippet}

{#snippet remove(favorite: App.Favorite, className: string)}
	<button
		class={cn(
			'tap grid shrink-0 place-items-center text-current/50 transition-colors hover:bg-current/10 hover:text-current',
			className,
		)}
		onclick={() => favoritesStore.remove(favorite)}
		aria-label="Remove {favorite.label} from favorites"
		title="Remove from favorites"
	>
		<CloseIcon />
	</button>
{/snippet}

{#snippet tile(favorite: App.Favorite)}
	{@const team = isTeam(favorite)}
	<li
		class={cn(
			'group/fav relative isolate flex anim-fade-to-r items-center gap-ch overflow-hidden rounded bg-current/5 p-ch',
			team && 'before:opacity-15',
		)}
		style:--team-bg={team
			? `url(https://midfield.mlbstatic.com/v1/team/${idOf(favorite)}/spots/32)`
			: undefined}
	>
		{@render image(favorite, 'size-8')}
		<a
			class="line-clamp-2 min-w-0 grow text-sm leading-tight decoration-dashed hover:underline"
			href={favorite.href}
		>
			{favorite.label}
			<span class="absolute inset-0"></span>
		</a>
		{@render remove(
			favorite,
			'relative size-6 rounded opacity-0 group-hover/fav:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100',
		)}
	</li>
{/snippet}

<style>
	/* At least 44px of tap target around small buttons */
	.tap {
		position: relative;

		&::before {
			content: '';
			position: absolute;
			inset: min(0px, calc((100% - 44px) / 2));
		}
	}
</style>
