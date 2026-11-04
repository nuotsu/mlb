export type DeviceKind = 'mobile' | 'tablet' | 'desktop'

/** Rough device summary from a user agent, for the "signed-in devices" list */
export function describeUserAgent(ua: string | null | undefined): {
	kind: DeviceKind
	label: string
} {
	if (!ua) return { kind: 'desktop', label: 'Unknown device' }

	const os = /iPad/.test(ua)
		? 'iPad'
		: /iPhone|iPod/.test(ua)
			? 'iPhone'
			: /Android/.test(ua)
				? 'Android'
				: /CrOS/.test(ua)
					? 'ChromeOS'
					: /Mac OS X|Macintosh/.test(ua)
						? 'Mac'
						: /Windows/.test(ua)
							? 'Windows'
							: /Linux/.test(ua)
								? 'Linux'
								: null

	const browser = /Edg(e|A|iOS)?\//.test(ua)
		? 'Edge'
		: /Firefox\/|FxiOS\//.test(ua)
			? 'Firefox'
			: /OPR\/|Opera/.test(ua)
				? 'Opera'
				: /Chrome\/|CriOS\//.test(ua)
					? 'Chrome'
					: /Safari\//.test(ua)
						? 'Safari'
						: null

	const kind: DeviceKind =
		os === 'iPad' || (/Android/.test(ua) && !/Mobile/.test(ua)) || /Tablet/.test(ua)
			? 'tablet'
			: os === 'iPhone' || /Mobi|Android/.test(ua)
				? 'mobile'
				: 'desktop'

	return { kind, label: [os, browser].filter(Boolean).join(' · ') || 'Unknown device' }
}
