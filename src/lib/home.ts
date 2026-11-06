/*
	Home page dashboard: the widgets, their default order and sizes, and the saved layout
	(`Settings.home`). Shared by the client (store, pre-paint script) and the server (sanitize).

	A saved layout is the full widget list in order. An empty list means "the defaults" (that's
	what Reset saves, so it syncs to other devices). Widgets added to the app later, which a saved
	layout doesn't know about, are appended at the end.
*/

export const HOME_WIDGETS = [
	'today',
	'team',
	'transactions',
	'blog',
	'standings',
	'players',
	'compare',
	'season',
] as const

export type HomeWidgetId = (typeof HOME_WIDGETS)[number]

/** S: 1 column · M: 2 columns · L: 2 columns, 2 rows · W: the whole row */
export const WIDGET_SIZES = ['S', 'M', 'L', 'W'] as const
export type WidgetSize = (typeof WIDGET_SIZES)[number]

export const WIDGET_SIZE_LABELS: Record<WidgetSize, string> = {
	S: 'small',
	M: 'medium',
	L: 'large',
	W: 'full width',
}

/** Columns and rows a size spans on the widest (4-column) grid */
export const SIZE_SPANS: Record<WidgetSize, { cols: number; rows: number }> = {
	S: { cols: 1, rows: 1 },
	M: { cols: 2, rows: 1 },
	L: { cols: 2, rows: 2 },
	W: { cols: 4, rows: 1 },
}

export const DEFAULT_SIZES: Record<HomeWidgetId, WidgetSize> = {
	today: 'W',
	team: 'M',
	transactions: 'M',
	blog: 'S',
	standings: 'S',
	players: 'M',
	compare: 'M',
	season: 'M',
}

/** As saved: sizes only when changed, `hidden` only when hidden */
export type HomeWidgetSetting = { id: HomeWidgetId; size?: WidgetSize; hidden?: boolean }
export type HomeSettings = { widgets: HomeWidgetSetting[] }

/** As shown */
export type HomeWidget = { id: HomeWidgetId; size: WidgetSize; hidden: boolean }

export const HOME_STORAGE_KEY = 'home'

function isWidgetId(id: unknown): id is HomeWidgetId {
	return HOME_WIDGETS.includes(id as HomeWidgetId)
}

function isSize(size: unknown): size is WidgetSize {
	return WIDGET_SIZES.includes(size as WidgetSize)
}

/** Validate an untrusted layout (localStorage or request body), dropping unknown widgets */
export function sanitizeHome(input: unknown): HomeSettings | undefined {
	if (!input || typeof input !== 'object') return undefined
	const { widgets } = input as Record<string, unknown>
	if (!Array.isArray(widgets)) return undefined

	const seen = new Set<HomeWidgetId>()
	const out: HomeWidgetSetting[] = []
	for (const raw of widgets.slice(0, 50)) {
		if (!raw || typeof raw !== 'object') continue
		const { id, size, hidden } = raw as Record<string, unknown>
		if (!isWidgetId(id) || seen.has(id)) continue
		seen.add(id)
		const widget: HomeWidgetSetting = { id }
		if (isSize(size) && size !== DEFAULT_SIZES[id]) widget.size = size
		if (hidden === true) widget.hidden = true
		out.push(widget)
	}
	return { widgets: out }
}

/** The saved layout filled out: every widget, in order, with its size */
export function resolveWidgets(saved: HomeWidgetSetting[] = []): HomeWidget[] {
	const seen = new Set<HomeWidgetId>()
	const out: HomeWidget[] = []
	for (const { id, size, hidden } of saved) {
		if (!isWidgetId(id) || seen.has(id)) continue
		seen.add(id)
		out.push({ id, size: isSize(size) ? size : DEFAULT_SIZES[id], hidden: hidden === true })
	}
	for (const id of HOME_WIDGETS) {
		if (!seen.has(id)) out.push({ id, size: DEFAULT_SIZES[id], hidden: false })
	}
	return out
}

export function serializeWidgets(widgets: HomeWidget[]): HomeWidgetSetting[] {
	return widgets.map(({ id, size, hidden }) => ({
		id,
		...(size !== DEFAULT_SIZES[id] && { size }),
		...(hidden && { hidden: true }),
	}))
}

/** Move one id to another's index (both from the same list) */
export function moveId<T>(ids: T[], id: T, to: number): T[] {
	const from = ids.indexOf(id)
	if (from === -1) return ids
	const target = Math.max(0, Math.min(ids.length - 1, to))
	if (from === target) return ids
	const next = ids.filter((x) => x !== id)
	next.splice(target, 0, id)
	return next
}

/**
 * Apply a new order of the visible widgets, keeping hidden ones where they were, so showing
 * one again puts it back near its old spot
 */
export function reorderVisible(widgets: HomeWidget[], visibleOrder: HomeWidgetId[]): HomeWidget[] {
	const byId = new Map(widgets.map((w) => [w.id, w]))
	const queue = visibleOrder.filter((id) => byId.get(id) && !byId.get(id)!.hidden)
	const placed = new Set(queue)
	// Visible widgets missing from the new order keep their relative order, after the rest
	for (const w of widgets) if (!w.hidden && !placed.has(w.id)) queue.push(w.id)
	return widgets.map((w) => (w.hidden ? w : byId.get(queue.shift()!)!))
}

export function nextSize(size: WidgetSize): WidgetSize {
	return WIDGET_SIZES[(WIDGET_SIZES.indexOf(size) + 1) % WIDGET_SIZES.length]
}

/**
 * Inline pre-paint script: applies the saved order, sizes, and hidden widgets to the
 * server-rendered (default) grid as CSS, so cached HTML shows your layout on first paint.
 * The page removes it (`#home-layout`) once it renders the saved layout itself.
 */
export function homeLayoutScript() {
	const ids = JSON.stringify(HOME_WIDGETS)
	const sizes = JSON.stringify(DEFAULT_SIZES)
	const spans = JSON.stringify(SIZE_SPANS)
	return `(()=>{try{const h=JSON.parse(localStorage.getItem(${JSON.stringify(HOME_STORAGE_KEY)})||'null'),w=h&&Array.isArray(h.widgets)?h.widgets:[];if(!w.length)return;const I=${ids},D=${sizes},S=${spans},o=[],n=new Set();for(const x of w)if(x&&I.includes(x.id)&&!n.has(x.id)){n.add(x.id);o.push(x)}for(const id of I)if(!n.has(id))o.push({id});let c='';o.forEach((x,i)=>{const s=S[x.size]||S[D[x.id]];c+='[data-home-widget="'+x.id+'"]{order:'+i+'!important;--w:'+s.cols+'!important;--h:'+s.rows+'!important'+(x.hidden===true?';display:none!important':'')+'}'});const e=document.createElement('style');e.id='home-layout';e.textContent=c;document.head.append(e)}catch{}})()`
}

/*
	Season phase, from the season's dates (YYYY-MM-DD strings compare in date order)
*/

export type SeasonPhase = 'offseason' | 'spring' | 'regular' | 'postseason'

type SeasonDates = Pick<
	MLB.SeasonDateInfo,
	'springStartDate' | 'regularSeasonStartDate' | 'postSeasonStartDate' | 'postSeasonEndDate'
>

export function seasonPhase(
	season: Partial<SeasonDates> | null | undefined,
	today: string,
): SeasonPhase {
	if (!season?.regularSeasonStartDate) return 'offseason'
	const { springStartDate, regularSeasonStartDate, postSeasonStartDate, postSeasonEndDate } = season
	if (postSeasonEndDate && today > postSeasonEndDate) return 'offseason'
	if (postSeasonStartDate && today >= postSeasonStartDate) return 'postseason'
	if (today >= regularSeasonStartDate) return 'regular'
	if (springStartDate && today >= springStartDate) return 'spring'
	return 'offseason'
}
