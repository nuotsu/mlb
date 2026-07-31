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
	let installed = $state(false)

	onMount(() => {
		if (!browser) return

		isStandalone =
			window.matchMedia('(display-mode: standalone)').matches ||
			('standalone' in navigator &&
				Boolean((navigator as Navigator & { standalone?: boolean }).standalone))

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
		if (!deferredPrompt) return

		if (!dev) {
			posthog.capture('pwa_install_clicked', { platform: 'browser' })
		}

		await deferredPrompt.prompt()
		const choice = await deferredPrompt.userChoice
		if (choice.outcome === 'accepted') {
			installed = true
			onboardingStore.dismiss(HINTS.INSTALL_PWA)
		}
		deferredPrompt = null
	}

	let hidden = $derived(isStandalone || installed)
</script>

{#if !hidden}
	<Hint id={HINTS.INSTALL_PWA} title="Add to your Home Screen" class={className}>
		<p>
			On iPhone or iPad, open this site in <strong>Safari</strong> and pin it like a regular app —
			no App Store needed. It opens full-screen and stays one tap away.
		</p>

		<ol>
			<li>Tap the <strong>Share</strong> button (the square with an arrow).</li>
			<li>Scroll and tap <strong>Add to Home Screen</strong>.</li>
			<li>Tap <strong>Add</strong> — the icon appears on your home screen.</li>
		</ol>

		{#if deferredPrompt}
			<button type="button" class="action" onclick={install}>Install app</button>
		{/if}
	</Hint>
{/if}
