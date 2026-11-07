<script lang="ts">
	import { ASCII_LOGO } from '#lib/ascii-logo.js'
	import AsciiReveal from '#ui/ascii-reveal.svelte'
	import Baseball from '#ui/baseball.svelte'
	import InstallHint from '#ui/onboarding/install-hint.svelte'
	import QuickSearch from '#ui/quick-search.svelte'
	import SetupChecklist from './setup-checklist.svelte'
</script>

<header class="hero border-b border-stroke">
	<div class="layout mx-auto grid max-w-5xl gap-x-[2lh] gap-y-lh px-ch py-[2lh]">
		<div class="title [grid-area:title]">
			<h1 class="flex max-w-max flex-col text-xl" aria-label="Welcome to MLB.TheOhtani.com">
				<div class="mb-1">Welcome to</div>
				<AsciiReveal
					text={ASCII_LOGO}
					class="-mt-ch overflow-x-auto overflow-y-clip text-left text-[x-small] leading-none"
				/>
				<p class="ml-auto">.TheOhtani.com</p>
			</h1>
			<p class="mt-ch text-balance italic [&_a]:decoration-dashed [&_a:hover]:underline">
				<a href="/schedule/day">Track MLB games</a>, <a href="/stats">explore stats</a>, and
				<a href="/api/v1">query the Stats API</a>, all in one app.
			</p>
		</div>

		<div class="ball [grid-area:ball]">
			<Baseball class="w-60 text-[8px]" />
		</div>

		<QuickSearch class="w-full max-w-md [grid-area:search]" />

		<div class="w-full max-w-md [grid-area:hint] empty:hidden">
			<SetupChecklist>
				{#snippet fallback()}
					<InstallHint />
				{/snippet}
			</SetupChecklist>
		</div>
	</div>
</header>

<style>
	.hero {
		container: hero / inline-size;
	}

	.layout {
		grid-template-areas: 'title' 'ball' 'search' 'hint';
		justify-items: center;
	}

	.title {
		text-align: center;

		h1 {
			margin-inline: auto;
		}
	}

	@container hero (width >= 48rem) {
		.layout {
			grid-template-columns: minmax(0, 1fr) auto;
			grid-template-areas: 'title ball' 'search ball' 'hint ball';
			justify-items: start;
			align-items: center;
		}

		.ball {
			align-self: center;
		}

		.title {
			text-align: start;

			h1 {
				margin-inline: 0;
			}
		}
	}
</style>
