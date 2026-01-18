<script lang="ts">
	import { CalendarIcon, JsonIcon } from '$ui/icons'
	import Drawer from './drawer.svelte'
</script>

<Drawer>
	<div
		class="flex h-full flex-col gap-ch overflow-clip"
	>
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
			<li><a href="https://github.com/nuotsu/mlb">Star on GitHub</a></li>
			<li><a href="https://nuotsu.dev">Built by nuotsu</a></li>
		</ul>
	</div>
</Drawer>

<style>
	div :global(svg) {
		flex-shrink: 0;
		width: 1em;
		height: 1em;
	}
</style>
