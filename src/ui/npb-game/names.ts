import type { NpbGamePlayerName, NpbLang, NpbPlayerRef } from '#lib/npb-game.js'

/** A player's name in the page's language: English from their roster, else npb.jp's Japanese */
export function playerName(
	player: NpbPlayerRef,
	names: Record<string, NpbGamePlayerName>,
	lang: NpbLang,
	form: 'short' | 'full' = 'short',
) {
	if (lang === 'ja' || !player.id) return player.nameJa
	return names[player.id]?.[form] ?? player.nameJa
}

/** `?lang=ja` switches the page to Japanese; English is the default */
export const LANG_PARAM = 'lang'

export const LANGS = [
	{ id: 'en', label: 'English' },
	{ id: 'ja', label: '日本語' },
] as const satisfies readonly { id: NpbLang; label: string }[]
