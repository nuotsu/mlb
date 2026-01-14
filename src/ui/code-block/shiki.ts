import type { Element, ElementContent, Text } from 'hast'
import { codeToHtml, type BundledLanguage } from 'shiki'

let i: number

export default async function ({
	code,
	lang,
	pre,
	className,
}: {
	code: string
	lang: BundledLanguage
	pre?: string
	className?: string
}) {
	i = 0

	return await codeToHtml(code, {
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
				span(node) {
					const { value } = node.children[0] as Text

					if (value.startsWith('"/api/')) {
						return {
							...node,
							tagName: 'a',
							properties: {
								...node.properties,
								class: 'underline decoration-dashed',
								href: value.slice(1, -1),
							},
						}
					}
				},
			},
		],
	})
}

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
