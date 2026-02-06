<script lang="ts">
	import { page } from '$app/state'
	import ClickToCopy from '$ui/click-to-copy.svelte'
	import CodeBlock from '$ui/code-block/code-block.svelte'
	import { HOST } from './constants'

	let form = $derived(page.form)
</script>

{#if form}
	{@const json = JSON.stringify(form.result, null, 2)}
	<article class="sm:overflow-y-auto">
		<menu
			class="sticky-below-header z-1 flex flex-wrap gap-[.5ch] p-ch text-sm max-sm:flex-col md:top-0 max-sm:[&_button]:w-full"
		>
			<li>
				<ClickToCopy value={form.fetchUrl} class="action-tertiary backdrop-blur-xs"
					>Copy full URL</ClickToCopy
				>
			</li>
			<li>
				<ClickToCopy value={form.fetchUrl.split(HOST)[1]} class="action-tertiary backdrop-blur-xs">
					Copy endpoint
				</ClickToCopy>
			</li>
			<li>
				<ClickToCopy value={json} class="action-tertiary backdrop-blur-xs"
					>Copy full response</ClickToCopy
				>
			</li>
		</menu>

		<CodeBlock
			code={json}
			lang="json"
			pre={form.fetchUrl}
			className="text-xs whitespace-pre-wrap"
		/>
	</article>
{/if}

<style>
	article {
		background-color: #0a0c10;
		color: #fff;
	}
</style>
