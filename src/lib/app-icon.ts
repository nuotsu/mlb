import { APP_ICONS, type AppIcon } from './account.js'

export const APP_ICON_KEY = 'app-icon'

export const APP_ICON_LABELS: Record<AppIcon, string> = {
	default: 'Original',
	blue: 'Blue glove',
	green: 'Green glove',
	red: 'Red glove',
	black: 'Black glove',
}

type IconFile =
	| 'favicon-16x16.png'
	| 'favicon-32x32.png'
	| 'favicon-48x48.png'
	| 'apple-touch-icon.png'
	| 'icon-192.png'

/** Public path of one size of an app icon */
export function appIconSrc(icon: AppIcon, file: IconFile) {
	if (icon === 'default') {
		return `/favicons/${file === 'icon-192.png' ? 'android-chrome-192x192.png' : file}?v=2`
	}
	return `/app-icons/${icon}/${file}`
}

export function isAppIcon(value: unknown): value is AppIcon {
	return APP_ICONS.includes(value as AppIcon)
}

/** Point the favicon and home-screen icon links at the chosen icon */
export function applyAppIcon(icon: AppIcon) {
	for (const link of document.querySelectorAll<HTMLLinkElement>(
		'link[rel="icon"][sizes], link[rel="apple-touch-icon"]',
	)) {
		const file =
			link.rel === 'apple-touch-icon'
				? 'apple-touch-icon.png'
				: (`favicon-${link.getAttribute('sizes')}.png` as IconFile)
		link.href = appIconSrc(icon, file)
	}
}

/** Inline <head> script: swap the favicon links before first paint, so there's no flash */
export function appIconScript() {
	const custom = APP_ICONS.filter((i) => i !== 'default').join('|')
	return `(()=>{try{const i=localStorage.getItem(${JSON.stringify(APP_ICON_KEY)});if(!i||!/^(${custom})$/.test(i))return;document.querySelectorAll('link[rel="icon"][sizes],link[rel="apple-touch-icon"]').forEach(l=>{l.href='/app-icons/'+i+'/'+(l.rel==='apple-touch-icon'?'apple-touch-icon.png':'favicon-'+l.getAttribute('sizes')+'.png')})}catch{}})()`
}
