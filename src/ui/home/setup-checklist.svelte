<script lang="ts">
	import { accountStore } from '#ui/account/store.svelte.js'
	import { favoritesStore } from '#ui/favorites/store.svelte.js'
	import { GoogleIcon } from '#ui/icons/index.js'
	import Loading from '#ui/loading.svelte'
	import Hint from '#ui/onboarding/hint.svelte'
	import { HINTS, onboardingStore } from '#ui/onboarding/store.svelte.js'
	import { onMount, type Snippet } from 'svelte'
	import { homeStore } from './store.svelte.js'

	let {
		class: className,
		fallback,
	}: {
		class?: string
		/** Shown instead once the checklist is done or dismissed */
		fallback?: Snippet
	} = $props()

	// Everything here comes from localStorage; swap it in after hydration
	let mounted = $state(false)
	onMount(() => (mounted = true))

	let signingIn = $state(false)

	type Step = {
		id: 'sign-in' | 'team' | 'layout'
		title: string
		description: string
		done: boolean
	}

	const steps = $derived(
		[
			accountStore.enabled && {
				id: 'sign-in',
				title: 'Sign in with Google',
				description: 'Favorites, spoiler settings, and time travel follow you to every device.',
				done: !!accountStore.user,
			},
			{
				id: 'team',
				title: 'Star your team',
				description: 'Its schedule and standings come first.',
				done: favoritesStore.favorites.some((f) => f.href.startsWith('/teams/')),
			},
			{
				id: 'layout',
				title: 'Make it yours',
				description: 'Drag, resize, or hide widgets.',
				done: homeStore.customized,
			},
		].filter((step): step is Step => !!step),
	)

	const done = $derived(steps.filter((s) => s.done).length)
	const visible = $derived(
		mounted && done < steps.length && !onboardingStore.isDismissed(HINTS.HOME_SETUP),
	)

	async function signIn() {
		signingIn = true
		await accountStore.signIn()
		// On success the page is navigating away (to Google, or the auth origin): keep spinning
		if (accountStore.signInError) signingIn = false
	}

	function editHome() {
		homeStore.editing = true
		document.getElementById('home-widgets')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
	}
</script>

<!-- Back from Google restores this page from the bfcache: stop the spinner -->
<svelte:window onpageshow={(event) => event.persisted && (signingIn = false)} />

{#if visible}
	<Hint
		id={HINTS.HOME_SETUP}
		title="Make this page yours · {done}/{steps.length}"
		class={className}
	>
		<ul class="list-none! space-y-ch! pl-0!">
			{#each steps as step (step.id)}
				<li class="flex gap-ch">
					<!-- centered on the title's line -->
					<span class="grid h-lh shrink-0 place-items-center" aria-hidden="true">
						<span
							class={[
								'size-[.8lh] rounded-full border',
								step.done ? 'border-accent bg-accent' : 'border-current/40',
							]}
						></span>
					</span>

					<div class="grid min-w-0 justify-items-start gap-[.5ch]">
						<p>
							<span class={['font-medium text-current', step.done && 'line-through opacity-60']}>
								{step.title}
							</span>
							<span class="sr-only">{step.done ? '(done)' : '(to do)'}</span>
							{#if !step.done}<br />{step.description}{/if}
						</p>

						{#if !step.done && step.id === 'sign-in'}
							<button
								class="relative action-tertiary min-h-9 overflow-clip rounded-full"
								onclick={signIn}
								disabled={signingIn}
								aria-busy={signingIn}
							>
								<GoogleIcon />
								Sign in with Google
								{#if signingIn}
									<Loading
										class="absolute inset-0 justify-center bg-background/50 backdrop-blur-xs"
									>
										Signing in...
									</Loading>
								{/if}
							</button>
							{#if accountStore.signInError}
								<p class="text-xs" role="alert">Couldn't start sign-in. Try again.</p>
							{/if}
						{:else if !step.done && step.id === 'team'}
							<a href="/teams">Browse teams</a>
						{:else if !step.done && step.id === 'layout'}
							<button class="button" onclick={editHome}>Edit home</button>
						{/if}
					</div>
				</li>
			{/each}
		</ul>
		{#if accountStore.enabled && !accountStore.user}
			<p class="text-xs">Everything works without an account, too.</p>
		{/if}
	</Hint>
{:else if mounted}
	{@render fallback?.()}
{/if}
