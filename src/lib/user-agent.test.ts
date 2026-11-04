/// <reference types="bun" />

import { describe, expect, test } from 'bun:test'
import { describeUserAgent } from './user-agent'

describe('describeUserAgent', () => {
	test.each([
		[
			'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
			'mobile',
			'iPhone · Safari',
		],
		[
			'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0 Mobile/15E148 Safari/604.1',
			'tablet',
			'iPad · Chrome',
		],
		[
			'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36',
			'mobile',
			'Android · Chrome',
		],
		[
			'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 Edg/130.0',
			'desktop',
			'Mac · Edge',
		],
		[
			'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0',
			'desktop',
			'Windows · Firefox',
		],
	])('%s', (ua, kind, label) => {
		expect(describeUserAgent(ua)).toEqual({ kind: kind as 'mobile', label })
	})

	test('handles a missing user agent', () => {
		expect(describeUserAgent(null)).toEqual({ kind: 'desktop', label: 'Unknown device' })
	})
})
