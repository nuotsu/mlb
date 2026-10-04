<script lang="ts">
	import { UMPIRE_POSITIONS } from '#lib/umpires.js'
	import { cn } from '#lib/utils.js'
	import Headshot from '#ui/player/headshot.svelte'

	let {
		official,
		headshot = true,
		class: className,
	}: { official: MLB.Official; headshot?: boolean; class?: string } = $props()
</script>

<span class={cn('flex items-center gap-ch', className)}>
	<abbr class="w-[2ch] shrink-0 text-xs text-current/40 no-underline" title={official.officialType}>
		{UMPIRE_POSITIONS[official.officialType] ?? official.officialType}
	</abbr>

	{#if headshot}
		<Headshot person={official.official} class="size-lh" />
	{/if}

	<span class="line-clamp-1 break-all" title={official.official.fullName}>
		{official.official.fullName}
	</span>
</span>
