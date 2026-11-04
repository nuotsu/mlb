<script lang="ts">
	import Avatar from '#ui/account/avatar.svelte'
	import { accountStore } from '#ui/account/store.svelte.js'
	import { PersonIcon } from '#ui/icons/index.js'
	import { browser } from '$app/env'
	import { page } from '$app/state'

	let { class: className }: { class?: string } = $props()

	// Server: from the layout data. Browser: the account store (seeded from the same data)
	let user = $derived(browser ? accountStore.user : (page.data.user ?? null))
	let active = $derived(page.url.pathname === '/account')
</script>

<a
	class={['tap', className, { active }]}
	href="/account"
	aria-label={user ? `Account: ${user.name}` : 'Account and settings'}
	aria-current={active ? 'page' : undefined}
	title={user ? user.name : 'Account and settings'}
>
	{#if user}
		<Avatar {user} class="avatar text-xs" size={28} />
	{:else}
		<PersonIcon class="transition-opacity not-hover:opacity-75" />
	{/if}
</a>

<style>
	/* 44px tap target around the small icon */
	.tap {
		position: relative;
		display: grid;
		place-items: center;

		&::before {
			content: '';
			position: absolute;
			inset: min(0px, calc((100% - 44px) / 2));
		}
	}

	.active :global(svg) {
		color: var(--color-accent);
	}

	/*
		24px, but laid out as 1rem (like the icons beside it) so the row keeps its height;
		the overflow sits in the row's padding. Icon-sized in the collapsed rail.
	*/
	a :global(.avatar) {
		--size: 24px;
		width: var(--size);
		height: var(--size);
		margin-block: calc((1rem - var(--size)) / 2);

		:global(html:has(#sidebar-open:not(:checked))) & {
			--size: 1rem;
		}
	}

	.active :global(.avatar) {
		outline: 1px solid var(--color-accent);
		outline-offset: 1px;
	}
</style>
