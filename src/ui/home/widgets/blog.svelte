<script lang="ts">
	import Rollup from '#ui/blog/rollup.svelte'
	import Widget from '../widget.svelte'
	import type { WidgetData } from './index.js'

	let { data }: { data: WidgetData } = $props()
</script>

<Widget title="Blog" href="/blog" linkLabel="All posts">
	<Rollup posts={data.posts} class="[&_time]:text-sm" limit={3} />
</Widget>
