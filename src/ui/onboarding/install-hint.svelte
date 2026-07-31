<script lang="ts">
	import { browser, dev } from '$app/environment'
	import Hint from '$ui/onboarding/hint.svelte'
	import { HINTS, onboardingStore } from '$ui/onboarding/store.svelte'
	import posthog from 'posthog-js'
	import { onMount } from 'svelte'

	type BeforeInstallPromptEvent = Event & {
		prompt: () => Promise<void>
		userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
	}

	let {
		class: className = '',
	}: {
		class?: string
	} = $props()

	let deferredPrompt = $state<BeforeInstallPromptEvent | null>(null)
	let isStandalone = $state(false)
	let isIos = $state(false)
	let showIosSteps = $state(false)
	let installed = $state(false)

	onMount(() => {
		if (!browser) return

		isStandalone =
			window.matchMedia('(display-mode: standalone)').matches ||
			('standalone' in navigator &&
				Boolean((navigator as Navigator & { standalone?: boolean }).standalone))

		const ua = navigator.userAgent
		isIos =
			/iPad|iPhone|iPod/.test(ua) ||
			(navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

		const onBeforeInstall = (event: Event) => {
			event.preventDefault()
			deferredPrompt = event as BeforeInstallPromptEvent
		}

		const onInstalled = () => {
			installed = true
			deferredPrompt = null
			onboardingStore.dismiss(HINTS.INSTALL_PWA)
		}

		window.addEventListener('beforeinstallprompt', onBeforeInstall)
		window.addEventListener('appinstalled', onInstalled)

		return () => {
			window.removeEventListener('beforeinstallprompt', onBeforeInstall)
			window.removeEventListener('appinstalled', onInstalled)
		}
	})

	async function install() {
		if (!dev) {
			posthog.capture('pwa_install_clicked', {
				platform: isIos ? 'ios' : deferredPrompt ? 'chromium' : 'other',
			})
		}

		if (deferredPrompt) {
			await deferredPrompt.prompt()
			const choice = await deferredPrompt.userChoice
			if (choice.outcome === 'accepted') {
				installed = true
				onboardingStore.dismiss(HINTS.INSTALL_PWA)
			}
			deferredPrompt = null
			return
		}

		if (isIos) {
			showIosSteps = !showIosSteps
		}
	}

	let hidden = $derived(isStandalone || installed)
</script>

{#if !hidden}
	<Hint id={HINTS.INSTALL_PWA} title="Install this like an app" class={className}>
		<p>
			Add this site to your phone or desktop like a regular app — no app store needed. It opens
			full-screen and stays one tap away.
		</p>

		{#if deferredPrompt || isIos}
			<button type="button" class="action" onclick={install}>
				{isIos && !deferredPrompt
					? showIosSteps
						? 'Hide steps'
						: 'Add to Home Screen'
					: 'Install app'}
			</button>
		{:else}
			<p>
				On Chrome or Edge, open the browser menu and choose <strong>Install app</strong> or
				<strong>Add to Home screen</strong>.
			</p>
		{/if}

		{#if showIosSteps}
			<ol>
				<li>Tap the Share button at the bottom of Safari.</li>
				<li>Scroll and tap <strong>Add to Home Screen</strong>.</li>
				<li>Tap <strong>Add</strong> — the app icon appears on your home screen.</li>
			</ol>
		{/if}
	</Hint>
{/if}
