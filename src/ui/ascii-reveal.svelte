<script lang="ts">
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
</script>

<!--
	The reveal is pure CSS so it plays from the first server-rendered paint, before hydration,
	without the finished text flashing first.
-->
<pre
	{...props}>{#each lines as line, row}{#each line as { char, delay, phase }}{#if char === ' '}{char}{:else}<span
					class="cell"
					style:--delay="{delay}ms"
					style:--phase={phase}>{char}</span
				>{/if}{/each}{#if row < lines.length - 1}{'\n'}{/if}{/each}</pre>

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
