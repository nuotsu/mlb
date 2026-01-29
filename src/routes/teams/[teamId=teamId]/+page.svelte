<script lang="ts">
	import type { PageProps } from './$types'

	let { data }: PageProps = $props()
</script>

<section class="p-ch">
	<h1>{data.team.name}</h1>
</section>
