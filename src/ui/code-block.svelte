<script lang="ts">
	import { codeToHtml, type BundledLanguage } from 'shiki'

	let {
		code,
		lang,
		className,
	}: {
		code: string
		lang: BundledLanguage
		className?: string
	} = $props()

	let html = async () =>
		await codeToHtml(code, {
			theme: 'dark-plus',
			lang,
			transformers: [
				{
					pre(node) {
						node.properties.class = node.properties.class
							? `${node.properties.class} ${className}`
							: className
					},
				},
			],
		})
</script>

{#await html()}
	<div>Loading...</div>
{:then html}
	{@html html}
{/await}
