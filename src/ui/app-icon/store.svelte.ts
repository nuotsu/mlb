import type { AppIcon } from '#lib/account.js'
import { APP_ICON_KEY, applyAppIcon, isAppIcon } from '#lib/app-icon.js'
import { settingsChanged } from '#ui/account/changes.js'
import { browser } from '$app/env'

function load(): AppIcon {
	if (!browser) return 'default'
	const stored = localStorage.getItem(APP_ICON_KEY)
	return isAppIcon(stored) ? stored : 'default'
}

export const appIconStore = $state({
	icon: load(),

	set(icon: AppIcon) {
		if (icon === this.icon) return
		this._replace(icon)
		settingsChanged()
	},

	/** Apply a value (from the account) without reporting it as a change */
	_replace(icon: AppIcon) {
		this.icon = icon
		if (!browser) return
		if (icon === 'default') localStorage.removeItem(APP_ICON_KEY)
		else localStorage.setItem(APP_ICON_KEY, icon)
		applyAppIcon(icon)
	},
})
