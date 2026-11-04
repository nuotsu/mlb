<script lang="ts">
	import type { AppIcon } from '#lib/account.js'
	import { APP_ICONS } from '#lib/account.js'
	import { APP_ICON_LABELS, appIconSrc } from '#lib/app-icon.js'
	import Avatar from '#ui/account/avatar.svelte'
	import { accountStore } from '#ui/account/store.svelte.js'
	import { appIconStore } from '#ui/app-icon/store.svelte.js'
	import { favoritesStore } from '#ui/favorites/store.svelte.js'
	import Header from '#ui/header.svelte'
	import {
		DeviceDesktopIcon,
		DeviceMobileIcon,
		DeviceTabletIcon,
		GoogleIcon,
	} from '#ui/icons/index.js'
	import Metadata from '#ui/metadata.svelte'
	import Logo from '#ui/team/logo.svelte'
	import { browser } from '$app/env'
	import { page } from '$app/state'
	import { onMount } from 'svelte'

	// Server: from the layout data. Browser: the account store (seeded from the same data)
	let user = $derived(browser ? accountStore.user : (page.data.user ?? null))

	// Browser-only state (localStorage) is swapped in after hydration
	let mounted = $state(false)
	onMount(() => (mounted = true))
	let selectedIcon = $derived<AppIcon>(mounted ? appIconStore.icon : 'default')

	// First favorite team, shown as a badge on the avatar
	let favoriteTeam = $derived(
		mounted ? favoritesStore.favorites.find((f) => f.href.startsWith('/teams/')) : undefined,
	)

	// Connected devices (browser only); reassigned after "sign out all other devices"
	let sessions = $derived(browser && user ? accountStore.listSessions() : null)
	let signingIn = $state(false)

	const DEVICE_ICONS = {
		mobile: DeviceMobileIcon,
		tablet: DeviceTabletIcon,
		desktop: DeviceDesktopIcon,
	}

	function formatDate(iso: string, options: Intl.DateTimeFormatOptions) {
		return new Date(iso).toLocaleDateString('en-US', options)
	}

	async function signIn() {
		signingIn = true
		await accountStore.signIn()
		signingIn = false
	}

	function signOut() {
		if (!confirm('Sign out? Your favorites and settings stay on this device.')) return
		accountStore.signOut()
	}

	function revokeOthers(others: number) {
		const devices = others === 1 ? '1 other device' : `${others} other devices`
		if (!confirm(`Sign out of ${devices}? This device stays signed in.`)) return
		sessions = accountStore.revokeOtherSessions()
	}
</script>

<Metadata title="Account | MLB.TheOhtani.com" description="Your account and app settings" />

<svelte:head>
	<meta name="robots" content="noindex" />
</svelte:head>

<Header title="Account" crumbs={[{ href: '/account', name: 'Account' }]} />

<div class="mx-auto grid max-w-xl gap-[2lh] px-ch py-lh">
	{#if page.data.accounts}
		<section class={user ? 'space-y-ch' : 'space-y-lh'}>
			{#if user}
				<div class="flex items-center gap-lh">
					<div class="relative shrink-0">
						<Avatar {user} class="size-16 text-2xl" size={64} />

						{#if favoriteTeam}
							<a
								class="absolute -right-1 -bottom-1 grid size-7 place-items-center rounded-full bg-background ring-1 ring-current/25"
								href={favoriteTeam.href}
								title="Favorite team: {favoriteTeam.label}"
							>
								<Logo
									class="size-5"
									team={{
										id: Number(favoriteTeam.href.split('/').pop()),
										name: favoriteTeam.label,
									} as MLB.Team}
								/>
							</a>
						{/if}
					</div>

					<div class="min-w-0 space-y-[.25ch]">
						<h2 class="truncate h3">{user.name}</h2>
						<p class="truncate text-sm text-current/60">{user.email}</p>
						<p class="text-xs text-current/60">
							Since {formatDate(user.createdAt, { month: 'long', day: 'numeric', year: 'numeric' })}
						</p>
						<button class="tap text-xs link" onclick={signOut}> Sign out </button>
					</div>
				</div>

				{#if accountStore.status === 'error'}
					<p class="text-xs text-current/60">Couldn't sync. Changes are saved on this device.</p>
				{/if}
			{:else}
				<header class="space-y-[.25ch]">
					<h2 class="h3">Sign in</h2>
					<p class="text-sm text-current/60">
						Sync your favorites and settings across devices. Everything keeps working without an
						account.
					</p>
				</header>
				<button class="action-tertiary min-h-11 rounded-full" onclick={signIn} disabled={signingIn}>
					<GoogleIcon />
					Sign in with Google
				</button>
			{/if}
		</section>
	{/if}

	<section class="space-y-ch">
		<h2 class="h3">App icon</h2>

		<fieldset class="grid grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))] gap-ch">
			<legend class="sr-only">App icon</legend>

			{#each APP_ICONS as icon (icon)}
				<label class="group/icon grid cursor-pointer justify-items-center gap-[.5ch] text-center">
					<input
						class="peer sr-only"
						type="radio"
						name="app-icon"
						value={icon}
						checked={selectedIcon === icon}
						onchange={() => appIconStore.set(icon)}
					/>
					<img
						class="size-14 rounded-[22%] object-cover ring-1 ring-current/25 transition-[box-shadow,transform] group-active/icon:scale-95 peer-checked:ring-2 peer-checked:ring-accent peer-checked:ring-offset-2 peer-checked:ring-offset-background peer-focus-visible:ring-2 peer-focus-visible:ring-current"
						src={appIconSrc(icon, 'icon-192.png')}
						alt=""
						width={112}
						height={112}
						loading="lazy"
						draggable="false"
					/>
					<span class="text-xs text-current/60 peer-checked:text-current">
						{APP_ICON_LABELS[icon]}
					</span>
				</label>
			{/each}
		</fieldset>
	</section>

	{#if user}
		<section class="space-y-ch">
			<h2 class="h3">Connected devices</h2>

			<!-- null on the server; the list loads in the browser -->
			{#await sessions ?? new Promise<never>(() => {})}
				<p class="text-sm text-current/60">Loading…</p>
			{:then list}
				{#if list?.length}
					<ul class="divide-y divide-current/10 border-y border-current/10">
						{#each list as session (session.id)}
							{@const Icon = DEVICE_ICONS[session.kind]}
							<li class="flex min-h-11 items-center gap-ch py-ch">
								<Icon
									class={session.current ? 'text-green-700 dark:text-accent' : 'text-current/60'}
								/>
								<div class="min-w-0">
									<p class="truncate text-sm">{session.label}</p>
									<p class="text-xs text-current/60">
										{session.current
											? 'This device'
											: `Active ${formatDate(session.lastActive, { month: 'short', day: 'numeric' })}`}
									</p>
								</div>
							</li>
						{/each}
					</ul>

					{#if list.length > 1}
						<button class="tap text-xs link" onclick={() => revokeOthers(list.length - 1)}
							>Sign out all other devices</button
						>
					{/if}
				{:else}
					<p class="text-sm text-current/60">Couldn't load devices.</p>
				{/if}
			{/await}
		</section>
	{/if}
</div>

<style>
	/* At least 44px of tap target around small text buttons */
	.tap {
		position: relative;

		&::before {
			content: '';
			position: absolute;
			inset: min(0px, calc((100% - 44px) / 2));
		}
	}
</style>
