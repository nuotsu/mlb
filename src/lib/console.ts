import { ASCII_LOGO } from '#lib/ascii-logo.js'
import { dev } from '$app/env'

if (!dev) {
	console.log(`${ASCII_LOGO.trimEnd()}.TheOhtani.com\n`)
}
