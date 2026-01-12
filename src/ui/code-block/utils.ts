import { CUSTOM_ENDPOINT_KEY } from '$ui/playground/constants'
import type { Element, ElementContent, Text } from 'hast'
import { codeToHtml, type BundledLanguage } from 'shiki'

let i = 0

export async function shiki({
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
							tagName: 'button',
							properties: {
								...node.properties,
								class: 'underline decoration-dashed',
								'data-href': value.slice(1, -1).replace('/api/v1/', ''),
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

export function addButtonHandlers(mutation: MutationRecord) {
	if (
		mutation.type === 'childList' &&
		['SECTION', 'TBODY', 'TR'].includes((mutation.target as unknown as Element).tagName)
	) {
		const form = document.querySelector('form')
		if (!form) return

		const select = form.querySelector('select[name="endpoint"]') as HTMLSelectElement
		if (!select) return

		document.querySelectorAll('pre code button').forEach((button) => {
			const { href } = (button as HTMLElement).dataset
			if (!href) return

			button.addEventListener('click', () => {
				select.value = CUSTOM_ENDPOINT_KEY
				select.dispatchEvent(new Event('change'))

				const customInput = document.querySelector('input#custom') as HTMLInputElement
				if (!customInput) return

				customInput.value = href

				form.submit()
			})
		})
	}
}
