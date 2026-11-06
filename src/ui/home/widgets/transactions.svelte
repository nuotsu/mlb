<script lang="ts">
	import TransactionByTeam from '#ui/transactions/by-team.svelte'
	import Widget from '../widget.svelte'
	import type { WidgetData } from './index.js'

	let { data }: { data: WidgetData } = $props()
</script>

<Widget title="Today's transactions" href="/transactions" bodyClass="">
	<div class="h-full [--height:11lh] *:border-0 [&_ul_p]:text-sm">
		<TransactionByTeam transactions={data.transactions} />
	</div>
</Widget>
