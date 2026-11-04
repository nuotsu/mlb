import { settingsChanged } from '#ui/account/changes.js'
import { browser } from '$app/env'

export const HINTS = {
	INSTALL_PWA: 'install-pwa',
	FAVORITE_TEAM: 'favorite-team',
	FAVORITE_BENEFITS: 'favorite-benefits',
} as const

export type HintId = (typeof HINTS)[keyof typeof HINTS]

function loadDismissed(): HintId[] {
	if (!browser) return []
	try {
		const parsed = JSON.parse(localStorage.getItem('onboarding-dismissed') || '[]')
		return Array.isArray(parsed) ? parsed : []
	} catch {
		return []
	}
}

export const onboardingStore = $state({
	dismissed: loadDismissed() as HintId[],

	isDismissed(id: HintId) {
		return this.dismissed.includes(id)
	},

	dismiss(id: HintId) {
		if (this.isDismissed(id)) return
		this.dismissed = [...this.dismissed, id]
		this._save()
		settingsChanged()
	},

	/** Replace everything (from the account) without reporting it as a change */
	_replace(dismissed: string[]) {
		this.dismissed = dismissed.filter((id): id is HintId =>
			(Object.values(HINTS) as string[]).includes(id),
		)
		this._save()
	},

	_save() {
		if (browser) {
			localStorage.setItem('onboarding-dismissed', JSON.stringify(this.dismissed))
		}
	},
})
