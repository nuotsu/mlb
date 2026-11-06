/**
 * The objects the homepage hero can show (`#ui/ascii-object.svelte`), one picked at random on
 * each visit. The page is cached for everyone, so the pick happens in the browser.
 */

import type { Shape } from './ascii-3d.js'
import { GLOVE } from './baseball-glove.js'
import { BASEBALL } from './baseball.js'
import { HOME_PLATE } from './home-plate.js'

export const ASCII_OBJECTS = {
	ball: BASEBALL,
	glove: GLOVE,
	plate: HOME_PLATE,
} satisfies Record<string, Shape>

export type AsciiObjectId = keyof typeof ASCII_OBJECTS

export const ASCII_OBJECT_IDS = Object.keys(ASCII_OBJECTS) as AsciiObjectId[]

export function isAsciiObjectId(id: unknown): id is AsciiObjectId {
	return ASCII_OBJECT_IDS.includes(id as AsciiObjectId)
}

/** A uniformly random object, unless `forced` names one. */
export function pickAsciiObject(random = Math.random, forced?: string | null): AsciiObjectId {
	if (isAsciiObjectId(forced)) return forced
	const i = Math.floor(random() * ASCII_OBJECT_IDS.length)
	return ASCII_OBJECT_IDS[Math.min(ASCII_OBJECT_IDS.length - 1, Math.max(0, i))]
}
