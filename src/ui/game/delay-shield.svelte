<script lang="ts">
	import { cn } from '#lib/utils.js'
	import { EyeIcon } from '#ui/icons/index.js'
	import type { Snippet } from 'svelte'

	/**
	 * Covers a section whose data can't be rewound while the page runs behind live,
	 * so it can't spoil anything until it's revealed or the delay is cleared.
	 */
	let {
		hidden,
		children,
		class: className,
	}: {
		/** Cover the content */
		hidden: boolean
		children: Snippet
		class?: string
	} = $props()

	/** Resets whenever `hidden` flips, so each new delay starts covered */
	let revealed = $derived.by(() => {
		void hidden
		return false
	})

	const covered = $derived(hidden && !revealed)

	let content = $state<HTMLDivElement>()

	// A clip that was already playing would keep talking under the cover
	$effect(() => {
		if (covered)
			content?.querySelectorAll<HTMLMediaElement>('video, audio').forEach((media) => media.pause())
	})
</script>

<div class={cn('relative isolate', covered && 'overflow-clip', className)}>
	<div
		bind:this={content}
		class={cn(covered && 'pointer-events-none blur-lg select-none')}
		inert={covered}
		aria-hidden={covered || undefined}
	>
		{@render children()}
	</div>

	{#if covered}
		<div
			class="absolute inset-0 z-10 grid place-content-center justify-items-center gap-[.5ch] bg-background/60 p-ch text-center text-xs backdrop-blur-xl"
		>
			<p class="text-current/60">Hidden while delayed</p>
			<button
				type="button"
				class="inline-flex items-center gap-[.5ch] rounded-full border border-current/25 bg-background px-[1.25ch] py-[.25ch] transition-colors outline-none hover:bg-accent/25 focus-visible:ring-2 focus-visible:ring-accent"
				onclick={() => (revealed = true)}
			>
				<EyeIcon class="size-[1.2em]" aria-hidden="true" />
				Reveal
			</button>
		</div>
	{/if}
</div>
