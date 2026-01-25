import type Anthropic from '@anthropic-ai/sdk'
import { DIRECTORY, HOST } from '$ui/playground/constants'

export const CLAUDE_MODEL = 'claude-haiku-4-5-20251001'
// 'claude-sonnet-4-5-20250929'

type Tool = Anthropic.Tool

/**
 * Convert endpoint path to a valid tool name
 * e.g., '/api/v1/people/{personId}/stats' -> 'get_person_stats'
 * Keeps path param hints to avoid duplicates: '/api/v1/teams/{teamId}' -> 'teams_by_id'
 */
// Store the mapping from tool names to paths (built during tool generation)
const toolNameToPath = new Map<string, string>()

function pathToToolName(path: string): string {
	return path
		.replace(/^\/api\/v[\d.]+\//, '') // remove /api/v1/ prefix
		.replace(/\{(\w+)\}/g, 'by_$1') // {personId} -> by_personId
		.replace(/\//g, '_') // slashes to underscores
		.replace(/_+/g, '_') // collapse multiple underscores
		.replace(/^_|_$/g, '') // trim leading/trailing underscores
		.replace(/Id/g, '') // remove "Id" suffix from params
		.toLowerCase()
}

// Endpoints to exclude from chatbot tools (still available in playground)
const EXCLUDED_ENDPOINTS = new Set([
	'/api/v1/gamePace',
	'/api/v1/gameStatus',
	'/api/v1/gameTypes',
	'/api/v1/jobs/{jobType}',
	'/api/v1/uniforms/game',
	'/api/v1/attendance',
	'/api/v1/game/changes',
	'/api/v1/people/changes',
	'/api/v1/people/freeAgents',
	'/api/v1/game/{gamePk}/contextMetrics',
])

/**
 * Generate Anthropic tool definitions from DIRECTORY
 */
export function generateTools(): Tool[] {
	const tools: Tool[] = []

	// Player search tool - essential for name resolution
	tools.push({
		name: 'search_player',
		description:
			'Search for a player by name to get their MLB personId. Use this FIRST when a user mentions a player by name (e.g., "Shohei", "Judge", "Ohtani").',
		input_schema: {
			type: 'object' as const,
			properties: {
				name: {
					type: 'string',
					description: 'Player name to search (partial match works)',
				},
			},
			required: ['name'],
		},
	})

	// Generate tools from DIRECTORY
	const seenNames = new Set<string>(['search_player'])

	for (const [_category, endpoints] of Object.entries(DIRECTORY)) {
		for (const [path, config] of Object.entries(endpoints)) {
			// Skip excluded endpoints and people/search (we have search_player)
			if (path === '/api/v1/people/search' || EXCLUDED_ENDPOINTS.has(path)) continue

			let toolName = pathToToolName(path)

			// Handle any remaining duplicates by appending a number
			if (seenNames.has(toolName)) {
				let i = 2
				while (seenNames.has(`${toolName}_${i}`)) i++
				toolName = `${toolName}_${i}`
			}
			seenNames.add(toolName)
			toolNameToPath.set(toolName, path)

			const properties: Record<string, unknown> = {}
			const required: string[] = []

			// Add path parameters
			if (config.pathParams) {
				for (const [param, presets] of Object.entries(config.pathParams)) {
					const examples = presets.slice(0, 2).map((p) => p.value)
					properties[param] = {
						type: 'string',
						description: `Path parameter. Examples: ${examples.join(', ')}`,
					}
					required.push(param)
				}
			}

			// Add query parameters
			if (config.queryParams) {
				for (const [param, presets] of Object.entries(config.queryParams)) {
					const examples = presets
						.filter((p) => p.value)
						.slice(0, 3)
						.map((p) => p.value)
					const labels = presets
						.filter((p) => p.label)
						.slice(0, 3)
						.map((p) => p.label)

					properties[param] = {
						type: 'string',
						description: labels.length
							? `Options: ${labels.join(', ')} (values: ${examples.join(', ')})`
							: `Examples: ${examples.join(', ')}`,
					}
				}
			}

			tools.push({
				name: toolName,
				description: config.description || `Fetch data from ${path}`,
				input_schema: {
					type: 'object' as const,
					properties,
					required: required.length > 0 ? required : undefined,
				},
			})
		}
	}

	return tools
}

/**
 * Map tool name back to endpoint path
 */
export function getEndpointPath(toolName: string): string | null {
	if (toolName === 'search_player') {
		return '/api/v1/people/search'
	}
	return toolNameToPath.get(toolName) ?? null
}

// Default field filters to reduce response size
const DEFAULT_FIELDS: Record<string, string> = {
	'/api/v1/people/search': 'people,id,fullName,currentTeam,name,primaryPosition,abbreviation',
	'/api/v1/people/{personId}':
		'people,id,fullName,birthDate,birthCity,birthStateProvince,birthCountry,height,weight,primaryPosition,name,batSide,description,pitchHand,mlbDebutDate,currentTeam',
	'/api/v1/people/{personId}/stats':
		'stats,type,displayName,group,displayName,gameType,splits,stat,season,team,name,game,gamePk,gamesPlayed,atBats,hits,homeRuns,rbi,avg,obp,slg,ops,wins,losses,era,strikeOuts,inningsPitched',
	'/api/v1/teams/{teamId}/roster':
		'roster,person,id,fullName,jerseyNumber,position,abbreviation,status,description',
	'/api/v1/standings':
		'records,standingsType,teamRecords,team,id,name,wins,losses,winningPercentage,gamesBack,streak,streakCode,divisionRank,leagueRank',
	'/api/v1/schedule':
		'dates,date,games,gamePk,officialDate,status,detailedState,teams,away,home,team,name,score,isWinner',
	'/api/v1/game/{gamePk}/boxscore':
		'teams,away,home,team,name,teamStats,batting,pitching,players,person,fullName,stats,battingOrder',
	'/api/v1/stats/leaders': 'leagueLeaders,leaders,rank,value,person,id,fullName,team,name',
}

/**
 * Execute a tool call by fetching from MLB Stats API
 */
export async function executeTool(
	toolName: string,
	input: Record<string, string>,
): Promise<unknown> {
	let path = getEndpointPath(toolName)
	if (!path) {
		throw new Error(`Unknown tool: ${toolName}`)
	}

	// Handle search_player specially
	if (toolName === 'search_player') {
		const url = new URL(HOST + path)
		url.searchParams.set('names', input.name)
		if (DEFAULT_FIELDS['/api/v1/people/search']) {
			url.searchParams.set('fields', DEFAULT_FIELDS['/api/v1/people/search'])
		}
		const response = await fetch(url)
		return response.json()
	}

	const originalPath = path

	// Replace path parameters
	for (const [key, value] of Object.entries(input)) {
		if (path.includes(`{${key}}`)) {
			path = path.replace(`{${key}}`, value)
		}
	}

	// Build URL with query parameters
	const url = new URL(HOST + path)
	for (const [key, value] of Object.entries(input)) {
		if (!originalPath.includes(`{${key}}`) && value) {
			url.searchParams.set(key, value)
		}
	}

	// Apply default field filter if not already specified
	if (!input.fields && DEFAULT_FIELDS[originalPath]) {
		url.searchParams.set('fields', DEFAULT_FIELDS[originalPath])
	}

	const response = await fetch(url)
	return response.json()
}

// Export pre-generated tools for use in API endpoint
export const TOOLS = generateTools()
