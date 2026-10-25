<script lang="ts">
	import { tick } from 'svelte'
	import type { HTMLAttributes } from 'svelte/elements'

	let { text, ...props }: { text: string } & HTMLAttributes<HTMLPreElement> = $props()

	/** Milliseconds between neighboring characters as the wave sweeps in from the top left. */
	const STAGGER = 12

	const lines = $derived.by(() => {
		let index = 0
		return text
			.replace(/\n$/, '')
			.split('\n')
			.map((line, row) =>
				[...line].map((char, col) => ({
					char,
					// Rows count double so the wave runs diagonally across the wide letters
					delay: (col + row * 2) * STAGGER,
					// Where each character starts in the flicker cycle, so neighbors don't match
					phase: (index++ * 7) % 10,
				})),
			)
	})

	let pre = $state<HTMLPreElement>()
	/** Bumped to replay: re-creating the characters restarts their CSS animations. */
	let run = $state(0)
	/** Until the reveal settles, taps are ignored so it can't be spammed. */
	let animating = $state(true)

	/** Waits for every character to settle; resolves right away if nothing is animating. */
	async function settle() {
		await Promise.allSettled(pre!.getAnimations({ subtree: true }).map((a) => a.finished))
		animating = false
	}

	$effect(() => {
		// The first reveal may still be playing when the page hydrates
		if (pre) settle()
	})

	async function replay() {
		if (animating) return
		animating = true
		run++
		await tick()
		await settle()
	}
</script>

<!--
	The reveal is pure CSS so it plays from the first server-rendered paint, before hydration,
	without the finished text flashing first. Tapping replays it, a decorative extra that's
	left out of keyboard navigation.
-->
<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<pre
	bind:this={pre}
	{...props}
	class={[props.class, !animating && 'cursor-pointer motion-reduce:cursor-auto']}
	onclick={replay}>{#key run}{#each lines as line, row}{#each line as { char, delay, phase }}{#if char === ' '}{char}{:else}<span
						class="cell"
						style:--delay="{delay}ms"
						style:--phase={phase}>{char}</span
					>{/if}{/each}{#if row < lines.length - 1}{'\n'}{/if}{/each}{/key}</pre>

<style>
	/* Each character stays hidden until the wave reaches it, flickers through random glyphs,
	   then settles from the accent color into its own */
	.cell {
		--flicker: 420ms;
		--settle: 200ms;
		--glyph: color-mix(in srgb, var(--color-accent) 70%, var(--color-foreground));

		position: relative;
		animation: settle calc(var(--flicker) + var(--settle)) var(--delay) backwards;

		&::before {
			content: '';
			position: absolute;
			inset: 0;
			visibility: hidden;
			color: var(--glyph);
			animation:
				scramble var(--flicker) var(--delay),
				flicker var(--flicker) linear calc(var(--delay) - var(--phase) * var(--flicker) / 10) 2;
		}

		@media (prefers-reduced-motion: reduce) {
			&,
			&::before {
				animation: none;
			}
		}
	}

	@keyframes settle {
		0%,
		67.7% {
			color: transparent;
		}

		67.8% {
			color: var(--glyph);
		}
	}

	@keyframes scramble {
		from,
		to {
			visibility: visible;
		}
	}

	@keyframes flicker {
		0% {
			content: '#';
		}
		10% {
			content: '%';
		}
		20% {
			content: '&';
		}
		30% {
			content: '*';
		}
		40% {
			content: '+';
		}
		50% {
			content: '/';
		}
		60% {
			content: '<';
		}
		70% {
			content: '=';
		}
		80% {
			content: '?';
		}
		90% {
			content: '@';
		}
		100% {
			content: '$';
		}
	}
</style>
