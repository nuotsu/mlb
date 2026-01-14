<script lang="ts">
	import Toggle from './toggle.svelte'
</script>

<nav
	class="relative z-1 w-0 bg-neutral-100/50 whitespace-nowrap backdrop-blur transition-[width] [grid-area:nav] max-md:inset-y-0 max-md:left-0 max-sm:absolute sm:w-6 sidebar-open:w-48"
>
	<Toggle />

	<div class="flex h-full flex-col overflow-clip">
		<div class="sidebar-closed-hidden">
			<a href="/"> MLB.TheOhtani.com </a>
		</div>

		<ul>
			<li><a href="/api/playground">Stats API Playground</a></li>
		</ul>

		<ul class="sidebar-closed-hidden mt-auto">
			<li><a href="https://github.com/nuotsu/mlb">View on GitHub</a></li>
			<li><a href="https://nuotsu.dev">Built by nuotsu</a></li>
		</ul>
	</div>
</nav>
