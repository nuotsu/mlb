import {
	HOME_STORAGE_KEY,
	nextSize,
	reorderVisible,
	resolveWidgets,
	sanitizeHome,
	serializeWidgets,
	type HomeSettings,
	type HomeWidget,
	type HomeWidgetId,
} from '#lib/home.js'
import { settingsChanged } from '#ui/account/changes.js'
import { browser } from '$app/env'

function load(): HomeSettings | undefined {
	if (!browser) return undefined
	try {
		return sanitizeHome(JSON.parse(localStorage.getItem(HOME_STORAGE_KEY) || 'null'))
	} catch {
		return undefined
	}
}

/*
	The home page layout. Works signed out (localStorage); signed in, it syncs with the other
	settings. `editing` is this page's edit mode and isn't saved.
*/
class HomeStore {
	saved = $state<HomeSettings | undefined>(load())
	editing = $state(false)

	/** Every widget in order, hidden ones included */
	widgets = $derived(resolveWidgets(this.saved?.widgets))

	/** Changed from the defaults at least once (Reset counts as a choice too) */
	customized = $derived(!!this.saved)

	update(id: HomeWidgetId, change: Partial<Omit<HomeWidget, 'id'>>) {
		this._set(this.widgets.map((w) => (w.id === id ? { ...w, ...change } : w)))
	}

	resize(id: HomeWidgetId) {
		const widget = this.widgets.find((w) => w.id === id)
		if (widget) this.update(id, { size: nextSize(widget.size) })
	}

	/** New order of the visible widgets; hidden ones keep their place */
	reorder(visibleOrder: HomeWidgetId[]) {
		this._set(reorderVisible(this.widgets, visibleOrder))
	}

	reset() {
		this._set([])
	}

	_set(widgets: HomeWidget[]) {
		this.saved = { widgets: widgets.length ? serializeWidgets(widgets) : [] }
		this._save()
		settingsChanged()
	}

	/** Replace everything (from the account) without reporting it as a change */
	_replace(home: HomeSettings) {
		this.saved = sanitizeHome(home)
		this._save()
	}

	_save() {
		if (!browser) return
		if (this.saved) localStorage.setItem(HOME_STORAGE_KEY, JSON.stringify(this.saved))
		else localStorage.removeItem(HOME_STORAGE_KEY)
	}
}

export const homeStore = new HomeStore()
