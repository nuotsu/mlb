<script lang="ts">
	import { ASCII_OBJECTS, pickAsciiObject, type AsciiObjectId } from '#lib/ascii-objects.js'
	import Avatar from '#ui/account/avatar.svelte'
	import { accountStore } from '#ui/account/store.svelte.js'
	import AsciiObject from '#ui/ascii-object.svelte'
	import AsciiReveal from '#ui/ascii-reveal.svelte'
	import InstallHint from '#ui/onboarding/install-hint.svelte'
	import QuickSearch from '#ui/quick-search.svelte'
	import { browser, dev } from '$app/env'
	import { page } from '$app/state'
	import { onMount } from 'svelte'
	import SetupChecklist from './setup-checklist.svelte'

	// Server: from the layout data. Browser: the account store (seeded from the same data)
	let user = $derived(browser ? accountStore.user : (page.data.user ?? null))
	let firstName = $derived(user?.name.split(' ')[0] || 'there')

	// The page is cached for everyone, so pick in the browser: the server (and hydration) draw an
	// empty box, and the pick lands before the first frame does. `?object=glove` forces one in dev
	let object = $state<AsciiObjectId>('ball')
	onMount(() => {
		object = pickAsciiObject(
			Math.random,
			dev ? new URLSearchParams(location.search).get('object') : null,
		)
	})

	const ascii = `$$\\      $$\\ $$\\       $$$$$$$\\
$$$\\    $$$ |$$ |      $$  __$$\\
$$$$\\  $$$$ |$$ |      $$ |  $$ |
$$\\$$\\$$ $$ |$$ |      $$$$$$$\\ |
$$ \\$$$  $$ |$$ |      $$  __$$\\
$$ |\\$  /$$ |$$ |      $$ |  $$ |
$$ | \\_/ $$ |$$$$$$$$\\ $$$$$$$  |
\\__|     \\__|\\________|\\_______/
`

	const STATUS = {
		idle: 'Signed in',
		syncing: 'Syncing…',
		synced: 'Synced across your devices',
		error: "Couldn't sync. Changes are saved on this device.",
	}
</script>

<header class="hero border-b border-stroke">
	<div class="layout mx-auto grid max-w-5xl gap-x-[2lh] gap-y-lh px-ch py-[2lh]">
		<div class="title [grid-area:title]">
			{#if user}
				<h1 class="sr-only">MLB.TheOhtani.com</h1>
				<div class="greeting flex items-center gap-ch">
					<Avatar {user} class="size-12 text-lg" size={48} />
					<div class="min-w-0">
						<p class="truncate h1">Welcome back, {firstName}</p>
						<p class="flex items-center gap-[.5ch] text-sm text-current/60">
							<span
								class={[
									'size-[.5lh] rounded-full',
									accountStore.status === 'error' ? 'bg-red-500' : 'bg-accent',
								]}
								aria-hidden="true"
							></span>
							{STATUS[accountStore.status]}
						</p>
					</div>
				</div>
			{:else}
				<h1 class="flex max-w-max flex-col text-xl" aria-label="Welcome to MLB.TheOhtani.com">
					<div class="mb-1">Welcome to</div>
					<AsciiReveal
						text={ascii}
						class="-mt-ch overflow-x-auto overflow-y-clip text-left text-[x-small] leading-none"
					/>
					<p class="ml-auto">.TheOhtani.com</p>
				</h1>
				<p class="mt-ch text-balance italic [&_a]:decoration-dashed [&_a:hover]:underline">
					<a href="/schedule/day">Track MLB games</a>, <a href="/stats">explore stats</a>, and
					<a href="/api/v1">query the Stats API</a>, all in one app.
				</p>
			{/if}
		</div>

		<div class="ball [grid-area:ball]">
			<AsciiObject shape={ASCII_OBJECTS[object]} class="w-60 text-[8px]" />
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

		.greeting {
			justify-content: center;
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

			.greeting {
				justify-content: start;
			}
		}
	}
</style>
