<script lang="ts">
	import type { AccountUser } from '#lib/account.js'

	let {
		user,
		size,
		class: className,
	}: {
		user: Pick<AccountUser, 'name' | 'email' | 'image'>
		/** Rendered size in px, for the image's intrinsic dimensions */
		size: number
		class?: string
	} = $props()

	let failed = $state(false)
	let initial = $derived((user.name || user.email || '?').trim().charAt(0).toUpperCase())
</script>

{#if user.image && !failed}
	<img
		class="shrink-0 rounded-full object-cover ring-1 ring-current/25 {className}"
		src={user.image}
		alt=""
		width={size * 2}
		height={size * 2}
		referrerpolicy="no-referrer"
		draggable="false"
		onerror={() => (failed = true)}
	/>
{:else}
	<span
		class="grid shrink-0 place-items-center rounded-full bg-accent font-bold text-black {className}"
		aria-hidden="true"
	>
		{initial}
	</span>
{/if}
