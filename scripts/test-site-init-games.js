const https = require('node:https');

const API_HOST = 'api.luckybet.site';
const API_PATH = '/?act=command&area=cmd';

function request(options, body) {
	return new Promise((resolve, reject) => {
		const req = https.request(options, res => {
			let data = '';
			res.on('data', chunk => data += chunk);
			res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, data }));
		});
		req.on('error', reject);
		if (body) {
			req.write(typeof body === 'string' ? body : JSON.stringify(body));
		}
		req.end();
	});
}

function extractCookies(resHeaders) {
	const raw = resHeaders['set-cookie'] || resHeaders['Set-Cookie'];
	if (!raw) return '';
	if (Array.isArray(raw)) {
		return raw.map(c => c.split(';')[0]).join('; ');
	}
	return raw.split(';')[0];
}

async function verifyPayloads() {
	const initRes = await request(
		{
			hostname: API_HOST,
			path: API_PATH,
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
		},
		{ cmd: 'siteInitialize', domain: 'https://luckybet.site' },
	);

	const initJson = JSON.parse(initRes.data);
	const beforeToken = initJson?.content?.before_token;
	const cookies = extractCookies(initRes.headers);

	console.log('before_token:', beforeToken);
	console.log('cookies:', cookies);

	// 1. Con cookies vs sin cookies
	const resWithCookies = await request(
		{
			hostname: API_HOST,
			path: API_PATH,
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Accept: 'application/json',
				Cookie: cookies,
			},
		},
		{
			cmd: 'getGameList',
			domain: 'https://luckybet.site',
			before_token: beforeToken,
		},
	);

	const resWithoutCookies = await request(
		{
			hostname: API_HOST,
			path: API_PATH,
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Accept: 'application/json',
			},
		},
		{
			cmd: 'getGameList',
			domain: 'https://luckybet.site',
			before_token: beforeToken,
		},
	);

	console.log('\n[Con Cookies]:', resWithCookies.data.substring(0, 150));
	console.log('[Sin Cookies]:', resWithoutCookies.data.substring(0, 150));

	const parsed = JSON.parse(resWithoutCookies.data);
	if (parsed.status === 'success' && parsed.content?.games) {
		const games = Object.values(parsed.content.games);
		console.log(`\n¡ÉXITO TOTAL! Total de juegos obtenidos: ${games.length}`);
		console.log('Muestra del primer juego:', games[0]);
	}
}

verifyPayloads().catch(console.error);
