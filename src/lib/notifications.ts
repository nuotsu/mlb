import { browser } from '$app/environment'
import { fetchDaySchedule } from '$lib/fetch/presets'
import { formatDate, getToday } from '$lib/temporal'

const timeoutIds: ReturnType<typeof setTimeout>[] = []

export async function requestPermission(): Promise<boolean> {
	if (!browser || !('Notification' in window)) return false
	if (Notification.permission === 'granted') return true
	if (Notification.permission === 'denied') return false

	const result = await Notification.requestPermission()
	return result === 'granted'
}

export async function scheduleForToday(favorites: App.Favorite[]): Promise<void> {
	if (!browser || !('Notification' in window) || !('serviceWorker' in navigator)) return
	if (Notification.permission !== 'granted') return

	clearScheduled()

	const teamIds = favorites
		.filter((f) => f.href.startsWith('/teams/'))
		.map((f) => Number(f.href.split('/').pop()))

	if (teamIds.length === 0) return

	const today = formatDate(getToday(), { locale: 'en-CA' })
	const schedule = await fetchDaySchedule(today)
	if (!schedule?.dates?.length) return

	const games = schedule.dates[0]?.games ?? []
	const now = Date.now()
	const reg = await navigator.serviceWorker.ready

	for (const game of games) {
		if (game.status.abstractGameState !== 'Preview') continue

		const homeId = game.teams.home.team.id
		const awayId = game.teams.away.team.id
		if (!teamIds.includes(homeId) && !teamIds.includes(awayId)) continue

		const delay = new Date(game.gameDate).getTime() - now
		if (delay <= 0) continue

		const away = game.teams.away.team.name
		const home = game.teams.home.team.name

		const id = setTimeout(() => {
			reg.showNotification('⚾ Game Starting Now', {
				body: `${away} @ ${home}`,
				icon: '/favicons/android-chrome-192x192.png',
				tag: `game-${game.gamePk}`,
				data: { url: `/game/${game.gamePk}` },
			})
		}, delay)

		timeoutIds.push(id)
	}
}

export function clearScheduled(): void {
	for (const id of timeoutIds) clearTimeout(id)
	timeoutIds.length = 0
}
