<script lang="ts">
	import { UMPIRE_POSITIONS } from '#lib/umpires.js'
	import { cn } from '#lib/utils.js'

	let { official, class: className }: { official: MLB.Official; class?: string } = $props()
</script>

<span class={cn('flex items-center gap-ch', className)}>
	<abbr class="w-[2ch] shrink-0 text-xs text-current/40 no-underline" title={official.officialType}>
		{UMPIRE_POSITIONS[official.officialType] ?? official.officialType}
	</abbr>

	<span class="line-clamp-1 break-all" title={official.official.fullName}>
		{official.official.fullName}
	</span>
</span>
