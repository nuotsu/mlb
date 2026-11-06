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

/**
 * localStorage cache of the chosen icon's home-screen image as `<icon> <data: URI>`. iOS 27's Add
 * to Home Screen sheet can't load a network apple-touch-icon, so the link must hold a data: URI
 * (the default one is inlined by hooks.server.ts; custom ones are fetched and cached here)
 */
export const APP_ICON_TOUCH_KEY = 'app-icon-touch'

/** Public path of a custom icon's compact home-screen image */
function touchIconSrc(icon: Exclude<AppIcon, 'default'>) {
	return `/app-icons/${icon}/apple-touch-icon.jpg`
}

function cachedTouchIcon(icon: AppIcon) {
	try {
		const cached = localStorage.getItem(APP_ICON_TOUCH_KEY)
		return cached?.startsWith(`${icon} data:`) ? cached.slice(icon.length + 1) : null
	} catch {
		return null
	}
}

function touchIconLink() {
	return document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]')
}

/** Point the favicon and home-screen icon links at the chosen icon */
export function applyAppIcon(icon: AppIcon) {
	for (const link of document.querySelectorAll<HTMLLinkElement>('link[rel="icon"][sizes]')) {
		link.href = appIconSrc(icon, `favicon-${link.getAttribute('sizes')}.png` as IconFile)
	}

	const link = touchIconLink()
	if (!link) return
	// Remember the server-rendered (inlined) default before the first swap away from it
	link.dataset.default ||= link.getAttribute('href') ?? ''

	if (icon === 'default') {
		link.href = link.dataset.default || appIconSrc('default', 'apple-touch-icon.png')
		return
	}
	const cached = cachedTouchIcon(icon)
	link.href = cached ?? touchIconSrc(icon)
	if (!cached) void cacheTouchIcon(icon)
}

/** Make sure a custom icon's home-screen image is cached as a data: URI and in the <head> */
export async function cacheTouchIcon(icon: AppIcon) {
	if (icon === 'default' || cachedTouchIcon(icon)) return
	try {
		const res = await fetch(touchIconSrc(icon))
		if (!res.ok) return
		const bytes = new Uint8Array(await res.arrayBuffer())
		let binary = ''
		for (let i = 0; i < bytes.length; i += 0x8000) {
			binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
		}
		const type = res.headers.get('content-type')?.split(';')[0] || 'image/jpeg'
		const dataUri = `data:${type};base64,${btoa(binary)}`
		localStorage.setItem(APP_ICON_TOUCH_KEY, `${icon} ${dataUri}`)
		// The choice may have changed while this was loading
		if (localStorage.getItem(APP_ICON_KEY) !== icon) return
		const link = touchIconLink()
		if (link) link.href = dataUri
	} catch {}
}

/**
 * Inline <head> script: swap the favicon and home-screen links before first paint, so there's no
 * flash. Uses the cached data: URI for the home-screen icon when there is one
 */
export function appIconScript() {
	const custom = APP_ICONS.filter((i) => i !== 'default').join('|')
	return `(()=>{try{const i=localStorage.getItem(${JSON.stringify(APP_ICON_KEY)});if(!i||!/^(${custom})$/.test(i))return;const t=localStorage.getItem(${JSON.stringify(APP_ICON_TOUCH_KEY)})||'';document.querySelectorAll('link[rel="icon"][sizes],link[rel="apple-touch-icon"]').forEach(l=>{if(l.rel!=='apple-touch-icon'){l.href='/app-icons/'+i+'/favicon-'+l.getAttribute('sizes')+'.png';return}l.dataset.default=l.getAttribute('href')||'';l.href=t.startsWith(i+' data:')?t.slice(i.length+1):'/app-icons/'+i+'/apple-touch-icon.jpg'})}catch{}})()`
}
