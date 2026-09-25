const APPLE_TV = /apple\s*tv/i

/** Whether the game streams on Apple TV (Friday Night Baseball). Matches "Apple TV" and "Apple TV+". */
export function isAppleTV(game: Pick<MLB.Game, 'broadcasts'>) {
	return !!game.broadcasts?.some(
		(b) => APPLE_TV.test(b.name ?? '') || APPLE_TV.test(b.callSign ?? ''),
	)
}
