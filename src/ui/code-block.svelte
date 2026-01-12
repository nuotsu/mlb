<script lang="ts">
	import Loading from '$ui/loading.svelte'
	import type { Element, ElementContent } from 'hast'
	import { codeToHtml, type BundledLanguage } from 'shiki'

	let {
		code,
		lang,
		pre,
		className,
	}: {
		code: string
		lang: BundledLanguage
		pre?: string
		className?: string
	} = $props()

	let i = 0

	let html = async () =>
		await codeToHtml(code, {
			theme: 'github-dark-high-contrast',
			lang,
			transformers: [
				{
					pre(node) {
						node.properties.class = `${node.properties.class} ${className}`
						node.properties['data-line-width'] = `${i.toString().length + 1}`
						node.properties['data-pre'] = pre
					},
					code: (node) => ({
						...node,
						children: fold(node.children),
					}),
				},
			],
		})

	function fold(children: ElementContent[], indent = 2) {
		const grouped = children.reduce<[ElementContent, ElementContent[]][]>((a, c) => {
			if (c.type === 'element') {
				if (getIndent(c) >= indent) {
					const last = a.at(-1)

					if (last) {
						last[1].push(c)
						return a
					}
				}

				return [...a, [c, []]]
			}

			return a
		}, [])

		const result: ElementContent[] = grouped.map(([c, contents]) => {
			i++
			const e = c as Element

			if (contents.length) {
				const children = [
					{
						type: 'element',
						tagName: 'summary',
						properties: {
							...e.properties,
							'data-indent': getIndent(e),
							'data-line': i,
						},
						children: e.children,
					},
					...fold(contents, indent + 2),
				] as ElementContent[]

				return {
					...e,
					tagName: 'details',
					properties: {
						...e.properties,
						'data-indent': getIndent(e),
						open: true,
					},
					children,
				}
			} else {
				return {
					...e,
					properties: {
						...e.properties,
						'data-indent': getIndent(e),
						'data-line': i,
					},
					children: [...e.children, { type: 'text', value: '\n' }],
				}
			}
		})

		return result
	}

	function getIndent(node?: Element) {
		const { value } = ((node?.children?.[0] as Element)?.children?.[0] as { value: string }) ?? ''
		return value?.match(/^\s*/)?.[0]?.length ?? 0
	}
</script>

{#await html()}
	<Loading class="loading-results p-ch" />
{:then html}
	{@html html}
{/await}
