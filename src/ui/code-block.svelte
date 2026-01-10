<script lang="ts">
	import type { Element, ElementContent } from 'hast'
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
						node.properties.class = `${node.properties.class} ${className}`
					},
					code(node) {
						return {
							...node,
							children: fold(node.children),
						} as Element
					},
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
			} else if (c.type === 'text') {
				console.log(c)
			}

			return a
		}, [])

		const result: ElementContent[] = grouped.map(([c, contents]) => {
			if (contents.length) {
				const e = c as Element

				return {
					...e,
					tagName: 'details',
					properties: {
						...e.properties,
						open: true,
					},
					children: [
						{
							type: 'element',
							tagName: 'summary',
							properties: {
								...e.properties,
							},
							children: e.children,
						},
						...fold(contents, indent + 2),
					],
				}
			} else {
				return {
					...c,
					children: [...(c as Element).children, { type: 'text', value: '\n' }],
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
	<div>Loading...</div>
{:then html}
	{@html html}
{/await}

<style>
	:global(.shiki summary) {
		/* display: block; */
	}
</style>
