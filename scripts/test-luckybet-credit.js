#!/usr/bin/env node

/**
 * Script interactivo/parametrizable para probar creditPlayer y debitPlayer directamente
 * contra la API de administración de LuckyBet (ag.luckybet.site).
 *
 * Uso:
 *   node scripts/test-luckybet-credit.js --user=serrot99 --amount=10 --bonus=30
 *   node scripts/test-luckybet-credit.js --user=serrot99 --amount=50 --bonus=0 --promocode=PROMO1
 *   node scripts/test-luckybet-credit.js --action=balance --user=serrot99
 *   node scripts/test-luckybet-credit.js --action=debit --user=serrot99 --amount=10
 */

const https = require('https');
const fs = require('fs');
const { URLSearchParams } = require('url');

// Cargar credenciales desde .env
let adminLogin = 'Tigreee4';
let adminPassword = 'Tgeee345';
let panelHost = 'ag.luckybet.site';

if (fs.existsSync('.env')) {
	const envContent = fs.readFileSync('.env', 'utf8');
	for (const line of envContent.split('\n')) {
		const trimmed = line.trim();
		if (trimmed.startsWith('LUCKYBET_ADMIN_LOGIN=')) {
			adminLogin = trimmed.replace('LUCKYBET_ADMIN_LOGIN=', '').trim();
		}
		if (trimmed.startsWith('LUCKYBET_ADMIN_PASSWORD=')) {
			adminPassword = trimmed.replace('LUCKYBET_ADMIN_PASSWORD=', '').trim();
		}
		if (trimmed.startsWith('LUCKYBET_PANEL_HOST=')) {
			const rawHost = trimmed.replace('LUCKYBET_PANEL_HOST=', '').trim();
			panelHost = rawHost.replace(/^https?:\/\//, '').replace(/\/+$/, '');
		}
	}
}

// Parsear argumentos de línea de comandos
function parseArgs() {
	const args = {
		action: 'credit', // 'credit' | 'debit' | 'balance' | 'search'
		user: 'serrot99',
		amount: 10,
		bonus: '0', // '0', '30', '40', '50', '100', '150', '200'
		cashierBonus: null,
		promocode: null,
		currency: 'ARS',
	};

	for (const arg of process.argv.slice(2)) {
		if (arg.startsWith('--action=')) args.action = arg.split('=')[1];
		if (arg.startsWith('--user=')) args.user = arg.split('=')[1];
		if (arg.startsWith('--amount=')) args.amount = Number(arg.split('=')[1]);
		if (arg.startsWith('--bonus=')) args.bonus = arg.split('=')[1];
		if (arg.startsWith('--cashierBonus=')) args.cashierBonus = arg.split('=')[1];
		if (arg.startsWith('--promocode=')) args.promocode = arg.split('=')[1];
		if (arg.startsWith('--currency=')) args.currency = arg.split('=')[1];
	}
	return args;
}

function request(options, body) {
	return new Promise((resolve, reject) => {
		const req = https.request(options, res => {
			let data = '';
			res.on('data', chunk => (data += chunk));
			res.on('end', () =>
				resolve({ statusCode: res.statusCode, headers: res.headers, data }),
			);
		});
		req.on('error', reject);
		if (body) req.write(body);
		req.end();
	});
}

async function login() {
	console.log(`\n[1/3] Autenticando admin (${adminLogin}) en https://${panelHost}...`);
	const loginBody = new URLSearchParams({
		login: adminLogin,
		password: adminPassword,
		area: 'login',
		act: 'admin',
	}).toString();

	const res = await request(
		{
			hostname: panelHost,
			path: '/index.php?act=admin&area=login',
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
				'Content-Length': Buffer.byteLength(loginBody),
			},
		},
		loginBody,
	);

	const rawCookie = res.headers['set-cookie'] || res.headers['Set-Cookie'];
	const cookieStr = Array.isArray(rawCookie) ? rawCookie.join('; ') : rawCookie || '';
	const match = cookieStr.match(/PHPSESSID=([^;]+)/i);
	const sessionId = match ? match[1] : null;

	if (!sessionId) {
		throw new Error(`Fallo de login. Headers devueltos: ${JSON.stringify(res.headers)}`);
	}

	console.log(`✔ Sesión iniciada. PHPSESSID: ${sessionId}`);
	return sessionId;
}

async function resolveUserId(sessionId, username) {
	if (/^\d+$/.test(String(username).trim())) {
		return String(username).trim();
	}

	console.log(
		`\n[2/3] Buscando ID numérico de LuckyBet para el usuario '${username}'...`,
	);
	const searchBody = new URLSearchParams({
		search_login: username,
		page: '1',
	}).toString();

	const res = await request(
		{
			hostname: panelHost,
			path: '/index.php?act=admin&area=search&response=js',
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
				'Content-Length': Buffer.byteLength(searchBody),
				Cookie: `PHPSESSID=${sessionId}`,
			},
		},
		searchBody,
	);

	const searchJson = JSON.parse(res.data);
	const matched = searchJson?.users?.find(
		u => u.login.toLowerCase() === username.toLowerCase(),
	);

	const userId = matched?.id || searchJson?.users?.[0]?.id;
	if (!userId) {
		throw new Error(`No se encontró el usuario '${username}' en LuckyBet.`);
	}

	console.log(`✔ Usuario resuelto: '${username}' -> LuckyBet ID: ${userId}`);
	return userId;
}

async function executeAction(sessionId, userId, args) {
	console.log(`\n[3/3] Ejecutando acción '${args.action}' para ID: ${userId}...`);

	if (args.action === 'balance') {
		const params = new URLSearchParams({
			act: 'admin',
			area: 'balance',
			response: 'js',
			id: String(userId),
			limit: '5',
		}).toString();

		const res = await request({
			hostname: panelHost,
			path: `/index.php?${params}`,
			method: 'GET',
			headers: { Cookie: `PHPSESSID=${sessionId}` },
		});

		console.log('\n=== RESPUESTA DE BALANCE ===');
		console.log(JSON.stringify(JSON.parse(res.data), null, 2));
		return;
	}

	const isCredit = args.action === 'credit';
	const url = `${panelHost ? `https://${panelHost}` : ''}/index.php?act=admin&area=balance&response=js&type=frame&printing=true&id=${userId}`;
	const path = `/index.php?act=admin&area=balance&response=js&type=frame&printing=true&id=${userId}`;

	const params = new URLSearchParams();
	params.append('balance_currency', args.currency);
	params.append('amount', String(args.amount));
	params.append('send', 'true');
	params.append('all', 'false');
	params.append('operation', isCredit ? 'in' : 'out');

	if (isCredit) {
		if (args.bonus !== null && args.bonus !== undefined) {
			params.append('bonus', String(args.bonus));
		}
		if (args.cashierBonus) {
			params.append('cashier_bonus', String(args.cashierBonus));
		}
		if (args.promocode) {
			params.append('promocode', args.promocode);
			params.append('promo', args.promocode);
		}
	}

	console.log('Payload enviado a LuckyBet:', params.toString());

	const res = await request(
		{
			hostname: panelHost,
			path: path,
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
				'Content-Length': Buffer.byteLength(params.toString()),
				Cookie: `PHPSESSID=${sessionId}`,
			},
		},
		params.toString(),
	);

	console.log('\n=== RESPUESTA RAW DE MUTACIÓN ===');
	try {
		const parsed = JSON.parse(res.data);
		console.log(JSON.stringify(parsed, null, 2));
		if (parsed.printUrl) {
			const match = parsed.printUrl.match(/operation=([0-9a-zA-Z_-]+)/);
			console.log(`\n✔ Operation ID extraído: ${match ? match[1] : 'No encontrado'}`);
		}
	} catch (e) {
		console.log(res.data);
	}
}

async function main() {
	const args = parseArgs();
	console.log('Parámetros de ejecución:', args);

	try {
		const sessionId = await login();
		const userId = await resolveUserId(sessionId, args.user);
		await executeAction(sessionId, userId, args);
	} catch (error) {
		console.error('\n❌ ERROR:', error.message || error);
		process.exit(1);
	}
}

main();
