<script lang="ts">
	import { browser } from '$app/environment'
	import { CloseIcon, InfoIcon } from '$ui/icons'
	import { onboardingStore, type HintId } from '$ui/onboarding/store.svelte'
	import type { Snippet } from 'svelte'
	import type { HTMLAttributes } from 'svelte/elements'

	let {
		id,
		title,
		class: className = '',
		children,
		...props
	}: {
		id: HintId
		title: string
		class?: string
		children: Snippet
	} & HTMLAttributes<HTMLElement> = $props()

	let visible = $derived(browser && !onboardingStore.isDismissed(id))
</script>

{#if visible}
	<aside
		class="relative flex gap-ch border border-stroke bg-neutral-100/50 p-ch text-sm dark:bg-neutral-800/50 {className}"
		{...props}
	>
		<InfoIcon class="mt-[.15lh] size-lh shrink-0 text-accent" aria-hidden="true" />

		<div class="min-w-0 grow space-y-[.5ch] pr-[2ch]">
			<p class="font-medium">{title}</p>
			<div
				class="space-y-[.5ch] text-current/70 [&_a]:underline [&_a]:decoration-dashed [&_a:hover]:decoration-solid [&_ol]:list-decimal [&_ol]:space-y-[.25ch] [&_ol]:pl-[2ch] [&_ul]:list-disc [&_ul]:space-y-[.25ch] [&_ul]:pl-[2ch]"
			>
				{@render children()}
			</div>
		</div>

		<button
			type="button"
			class="absolute top-ch right-ch text-current/40 transition-colors hover:text-current"
			aria-label="Dismiss tip"
			onclick={() => onboardingStore.dismiss(id)}
		>
			<CloseIcon class="size-lh" />
		</button>
	</aside>
{/if}
