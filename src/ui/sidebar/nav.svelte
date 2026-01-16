<script lang="ts">
	import { cn } from '$lib/utils'
	import { CalendarIcon, JsonIcon } from '$ui/icons'
	import Toggle from './toggle.svelte'
</script>

<nav
	class={cn(
		'relative z-1 bg-neutral-100/50 p-ch whitespace-nowrap backdrop-blur [grid-area:nav] sm:w-[calc(2ch+1rem)] sm:transition-[width]',
		'max-sm:absolute max-sm:inset-y-0 max-sm:left-0 max-sm:transition-transform max-sm:sidebar-not-open:-translate-x-full',
	)}
>
	<Toggle />

	<div class="flex h-full flex-col gap-ch overflow-clip">
		<div class="sm:sidebar-closed-hidden">
			<a href="/"> MLB.TheOhtani.com </a>
		</div>

		<ul>
			<li>
				<a href="/schedule" class="flex items-center gap-1">
					<CalendarIcon />
					<span class="sm:sidebar-closed-hidden">Weekly Schedule</span>
				</a>
			</li>
			<li>
				<a href="/api/playground" class="flex items-center gap-1">
					<JsonIcon />
					<span class="sm:sidebar-closed-hidden">Stats API Playground</span>
				</a>
			</li>
		</ul>

		<ul class="mt-auto text-sm sm:sidebar-closed-hidden">
			<li><a href="https://github.com/nuotsu/mlb">View on GitHub</a></li>
			<li><a href="https://nuotsu.dev">Built by nuotsu</a></li>
		</ul>
	</div>
</nav>

<style>
	nav {
		padding-left: max(1ch, env(safe-area-inset-left));

		:global(body:has(#sidebar-open:checked)) & {
			width: calc(200px + env(safe-area-inset-right));
		}

		:global(svg) {
			flex-shrink: 0;
			width: 1em;
			height: 1em;
		}
	}
</style>
