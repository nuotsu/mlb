<script lang="ts">
	import type { TimelinePitcher } from '#lib/time-travel.js'
	import { cn } from '#lib/utils.js'
	import { ChevronLeftIcon, ChevronRightIcon, HistoryIcon } from '#ui/icons/index.js'

	let {
		timeline,
		value,
		delay,
		final,
		onselect,
		onnudge,
		onstep,
		canStepBack = false,
		canStepForward = false,
		class: className,
	}: {
		/** Pitches up to the moment on screen, grouped by pitcher */
		timeline: TimelinePitcher[]
		/** `'live'`, or the start time of the pitch on screen */
		value: string
		/** How far behind live the page runs, in ms; `null` is live */
		delay: number | null
		/** The game is over, so "live" means the final state */
		final?: boolean
		/** A pitch's start time, or `null` for live */
		onselect: (startTime: string | null) => void
		/** Shift the delay by this many ms (positive is further back) */
		onnudge: (ms: number) => void
		/** Show the pitch before (`-1`) or after (`1`) the one on screen */
		onstep: (step: -1 | 1) => void
		/** There's a pitch before the one on screen */
		canStepBack?: boolean
		/** There's a pitch, or live, after the one on screen */
		canStepForward?: boolean
		class?: string
	} = $props()

	const NUDGE_MS = 3_000

	const delayed = $derived(delay != null)

	function formatDelay(ms: number) {
		const total = Math.round(ms / 1000)
		const h = Math.floor(total / 3600)
		const m = Math.floor((total % 3600) / 60)
		const s = String(total % 60).padStart(2, '0')
		return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`
	}

	function describeDelay(ms: number) {
		const total = Math.round(ms / 1000)
		const h = Math.floor(total / 3600)
		const m = Math.floor((total % 3600) / 60)
		const s = total % 60
		const parts = [
			h && `${h} hour${h === 1 ? '' : 's'}`,
			m && `${m} minute${m === 1 ? '' : 's'}`,
			(s || total === 0) && `${s} second${s === 1 ? '' : 's'}`,
		]
		return `${parts.filter(Boolean).join(' ')} behind live`
	}

	/** One height for every control, so the row doesn't jump between live and delayed */
	const control = 'h-[2.2em] shrink-0 rounded-full'
	const stepper =
		'grid place-items-center px-[.5ch]! text-current/60 hover:bg-accent/25 hover:text-current disabled:pointer-events-none disabled:text-current/20'
	const pill =
		'rounded-full px-[1ch] whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent sm:px-[1.25ch]'
</script>

<div
	id="time-travel"
	role="group"
	aria-label="Delay"
	class={cn(
		'no-scrollbar flex items-center gap-[.75ch] overflow-x-auto px-ch py-[.5ch] text-xs sm:gap-ch',
		className,
	)}
>
	<p
		class="flex shrink-0 items-center gap-[.5ch]"
		aria-live="polite"
		title={delay != null ? describeDelay(delay) : undefined}
	>
		{#if delayed}
			<HistoryIcon class="size-[1.2em] text-amber-600 dark:text-amber-300" aria-hidden="true" />
			<span class="text-amber-700 dark:text-amber-300">Delayed</span>
		{:else if final}
			<span class="size-[.8em] rounded-full bg-current/40" aria-hidden="true"></span>
			<span class="text-current/50">Final</span>
		{:else}
			<span class="relative grid size-[.8em] place-items-center" aria-hidden="true">
				<span
					class="absolute inset-0 rounded-full bg-accent motion-safe:animate-ping motion-safe:opacity-75"
				></span>
				<span class="relative size-full rounded-full bg-green-600 dark:bg-accent"></span>
			</span>
			<span class="positive dark:text-accent">Live</span>
		{/if}
	</p>

	<select
		class={cn(
			pill,
			control,
			// Sized to the chosen option rather than the longest one, where supported
			'[field-sizing:content] max-w-[20ch] appearance-none border border-current/25 bg-background pr-[2.25ch]! text-ellipsis hover:bg-accent/25',
		)}
		aria-label="Sync to a pitch"
		title="Pick the pitch your stream is showing"
		{value}
		onchange={(e) => {
			const next = e.currentTarget.value
			onselect(next === 'live' ? null : next)
		}}
	>
		<option value="live">Live</option>
		{#if delayed && !timeline.some(({ pitches }) => pitches.length)}
			<option value="" disabled>Before first pitch</option>
		{/if}
		{#each timeline as pitcher (pitcher.id)}
			<optgroup label={pitcher.fullName}>
				{#each pitcher.pitches as { startTime, number } (startTime)}
					<option value={startTime}>{pitcher.lastName} · #{number}</option>
				{/each}
			</optgroup>
		{/each}
	</select>

	<div class={cn(control, 'flex items-stretch gap-px border border-current/25 p-px')}>
		<button
			type="button"
			class={cn(pill, stepper)}
			aria-label="Previous pitch"
			title="Previous pitch"
			disabled={!canStepBack}
			onclick={() => onstep(-1)}
		>
			<ChevronLeftIcon class="size-[1.2em]" aria-hidden="true" />
		</button>
		<button
			type="button"
			class={cn(pill, stepper)}
			aria-label="Next pitch"
			title="Next pitch"
			disabled={!canStepForward}
			onclick={() => onstep(1)}
		>
			<ChevronRightIcon class="size-[1.2em]" aria-hidden="true" />
		</button>
	</div>

	{#if delayed}
		<div class={cn(control, 'flex items-stretch gap-px border border-current/25 p-px')}>
			<button
				type="button"
				class={cn(pill, 'px-[.75ch]! text-current/60 hover:bg-accent/25 hover:text-current')}
				aria-label="Back 3 seconds"
				onclick={() => onnudge(NUDGE_MS)}
			>
				−3s
			</button>

			<!-- Room is tight on phones; the status's tooltip and screen readers still get it -->
			<span
				class="self-center px-[.5ch] text-current/50 tabular-nums max-sm:hidden"
				aria-hidden="true"
			>
				−{formatDelay(delay!)}
			</span>
			<span class="sr-only">{describeDelay(delay!)}</span>

			<button
				type="button"
				class={cn(pill, 'px-[.75ch]! text-current/60 hover:bg-accent/25 hover:text-current')}
				aria-label="Forward 3 seconds"
				onclick={() => onnudge(-NUDGE_MS)}
			>
				+3s
			</button>
		</div>

		<button
			type="button"
			class={cn(pill, control, 'bg-accent text-dark hover:bg-accent/80')}
			onclick={() => onselect(null)}
		>
			Go live
		</button>
	{/if}
</div>

<style>
	/* A caret for the native select, which loses its own under `appearance: none` */
	select {
		background-image:
			linear-gradient(45deg, transparent 50%, currentColor 50%),
			linear-gradient(135deg, currentColor 50%, transparent 50%);
		background-position:
			calc(100% - 1.1ch) 55%,
			calc(100% - 0.75ch) 55%;
		background-size: 0.35ch 0.35ch;
		background-repeat: no-repeat;
	}
</style>
