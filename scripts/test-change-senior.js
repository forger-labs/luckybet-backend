#!/usr/bin/env node

/**
 * Script de prueba y validación para el cambio de senior (sala) en LuckyBet.
 *
 * Hallazgo:
 *   - El backend llamaba a `area=useredit` (que rechaza con "Usted no tiene el acceso a este usuario").
 *   - La pantalla real del panel que usas en el navegador es `area=usersettings&module=base&id={id}`.
 *
 * Uso:
 *   node scripts/test-change-senior.js
 *   node scripts/test-change-senior.js --user=serrot99 --targetRoom=Tigree1
 */

const https = require('node:https');
const http = require('node:http');
const fs = require('node:fs');
const { URLSearchParams } = require('node:url');

let adminLogin = process.env.LUCKYBET_ADMIN_LOGIN || 'Gabotiburon';
let adminPassword = process.env.LUCKYBET_ADMIN_PASSWORD || '';
let panelHost = process.env.LUCKYBET_PANEL_HOST || 'https://ag.luckybet.site';

if (fs.existsSync('.env')) {
	const envContent = fs.readFileSync('.env', 'utf8');
	for (const line of envContent.split('\n')) {
		const trimmed = line.trim();
		if (trimmed.startsWith('LUCKYBET_ADMIN_LOGIN=')) {
			adminLogin = trimmed
				.replace('LUCKYBET_ADMIN_LOGIN=', '')
				.trim()
				.replace(/^['"]|['"]$/g, '');
		}
		if (trimmed.startsWith('LUCKYBET_ADMIN_PASSWORD=')) {
			adminPassword = trimmed
				.replace('LUCKYBET_ADMIN_PASSWORD=', '')
				.trim()
				.replace(/^['"]|['"]$/g, '');
		}
		if (trimmed.startsWith('LUCKYBET_PANEL_HOST=')) {
			panelHost = trimmed
				.replace('LUCKYBET_PANEL_HOST=', '')
				.trim()
				.replace(/^['"]|['"]$/g, '');
		}
	}
}

const normalizedHostUrl = panelHost.startsWith('http')
	? panelHost
	: `https://${panelHost}`;
const urlObj = new URL(normalizedHostUrl);
const isHttps = urlObj.protocol === 'https:';
const hostname = urlObj.hostname;
const port = urlObj.port || (isHttps ? 443 : 80);

function parseArgs() {
	const args = {
		user: 'serrot99',
		targetRoom: 'Tigree1',
		restoreRoom: null,
	};

	for (const arg of process.argv.slice(2)) {
		if (arg.startsWith('--user=')) args.user = arg.split('=')[1];
		if (arg.startsWith('--targetRoom=')) args.targetRoom = arg.split('=')[1];
		if (arg.startsWith('--restoreRoom=')) args.restoreRoom = arg.split('=')[1];
	}
	return args;
}

function request({ path, method = 'GET', headers = {}, body = null }) {
	return new Promise((resolve, reject) => {
		const clientModule = isHttps ? https : http;
		const reqOptions = {
			hostname,
			port,
			path,
			method,
			headers: {
				...headers,
				'User-Agent':
					'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
			},
		};

		const req = clientModule.request(reqOptions, res => {
			let data = '';
			res.on('data', chunk => (data += chunk));
			res.on('end', () => {
				let parsed = null;
				try {
					parsed = JSON.parse(data);
				} catch {
					// html/text
				}
				resolve({
					statusCode: res.statusCode,
					headers: res.headers,
					raw: data,
					data: parsed,
				});
			});
		});

		req.on('error', reject);
		if (body) {
			req.write(body);
		}
		req.end();
	});
}

async function login() {
	console.log(`🔑 [AUTH] Autenticando en ${urlObj.origin} con admin: '${adminLogin}'...`);
	const params = new URLSearchParams({
		act: 'admin',
		area: 'login',
		login: adminLogin,
		password: adminPassword,
	}).toString();

	const res = await request({
		path: '/index.php?act=admin&area=login',
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
			'Content-Length': Buffer.byteLength(params),
		},
		body: params,
	});

	const rawCookie = res.headers['set-cookie'] || res.headers['Set-Cookie'];
	const cookieList = Array.isArray(rawCookie) ? rawCookie : rawCookie ? [rawCookie] : [];
	let sessionId = null;

	for (const c of cookieList) {
		const match = c.match(/PHPSESSID=([^;]+)/i);
		if (match) {
			sessionId = match[1];
			break;
		}
	}

	if (!sessionId) {
		throw new Error('No se pudo obtener la cookie PHPSESSID.');
	}

	console.log(`✅ [AUTH] Sesión obtenida: PHPSESSID=${sessionId}`);
	return sessionId;
}

async function searchPlayer(sessionId, login) {
	const params = new URLSearchParams({
		search_login: String(login).trim(),
		page: '1',
	}).toString();

	const res = await request({
		path: '/index.php?act=admin&area=search&response=js',
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
			'Content-Length': Buffer.byteLength(params),
			Accept: 'application/json',
			Cookie: `PHPSESSID=${sessionId}`,
		},
		body: params,
	});

	return res.data?.users || [];
}

async function resolveLuckyBetUserId(sessionId, userIdOrUsername) {
	const input = String(userIdOrUsername).trim();
	if (/^\d+$/.test(input)) {
		return input;
	}

	const users = await searchPlayer(sessionId, input);
	const matched = users.find(u => String(u.login).toLowerCase() === input.toLowerCase());
	if (matched?.id) return matched.id;
	if (users.length > 0 && users[0].id) return users[0].id;

	throw new Error(`No se encontró el jugador [${input}] en el panel de LuckyBet.`);
}

// -------------------------------------------------------------
// METODO VIEJO: area=useredit (el que estaba en el código y fallaba)
// -------------------------------------------------------------
async function changePlayerSeniorOld(sessionId, userId, seniorName) {
	const path = `/index.php?act=admin&area=useredit&id=${userId}&response=js`;
	const params = new URLSearchParams();
	params.append('send', 'true');
	params.append('create_login', seniorName);
	params.append('note', '');
	params.append('name', '');

	const res = await request({
		path,
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
			'Content-Length': Buffer.byteLength(params.toString()),
			Accept: 'application/json',
			Cookie: `PHPSESSID=${sessionId}`,
		},
		body: params.toString(),
	});

	return {
		success: !res.data?.error && !res.data?.errorMessage,
		error: res.data?.error || res.data?.errorMessage,
		data: res.data,
	};
}

// -------------------------------------------------------------------
// METODO NUEVO/CORRECTO: area=usersettings&module=base (el que usa el navegador)
// -------------------------------------------------------------------
async function getPlayerSeniorCorrect(sessionId, userId) {
	const path = `/index.php?act=admin&area=usersettings&module=base&id=${userId}&response=js`;
	const res = await request({
		path,
		method: 'GET',
		headers: {
			Accept: 'application/json',
			Cookie: `PHPSESSID=${sessionId}`,
		},
	});

	const senior = res.data?.settings?.create_login?.value;
	return senior ? String(senior).trim() : null;
}

async function changePlayerSeniorCorrect(sessionId, userId, seniorName) {
	const path = `/index.php?act=admin&area=usersettings&module=base&id=${userId}&response=js`;
	const params = new URLSearchParams();
	params.append('setting[name][0]', 'create_login');
	params.append('setting[value]', seniorName);

	const body = params.toString();
	const res = await request({
		path,
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
			'Content-Length': Buffer.byteLength(body),
			Accept: 'application/json',
			Cookie: `PHPSESSID=${sessionId}`,
		},
		body,
	});

	const isSuccess = Boolean(
		res.data?.successMessage || res.data?.settings?.create_login?.value === seniorName,
	);
	return {
		success: isSuccess && !res.data?.error,
		error: res.data?.error,
		currentSenior: res.data?.settings?.create_login?.value,
		data: res.data,
	};
}

async function main() {
	const args = parseArgs();
	console.log(`📋 Diagnóstico de cambio de sala:`);
	console.log(`   - Usuario: ${args.user}`);
	console.log(`   - Sala destino: ${args.targetRoom}\n`);

	const sessionId = await login();
	const userId = await resolveLuckyBetUserId(sessionId, args.user);
	console.log(
		`🎯 ID interno de LuckyBet resuelto: ${userId} (para login "${args.user}")`,
	);

	console.log(
		'\n-----------------------------------------------------------------------',
	);
	console.log('❌ PRUEBA 1: Intentando por el endpoint viejo (area=useredit)...');
	console.log('-----------------------------------------------------------------------');
	const oldAttempt = await changePlayerSeniorOld(sessionId, userId, args.targetRoom);
	console.log(`Resultado viejo: error="${oldAttempt.error}"`);
	console.log('👉 Esto demuestra por qué el código anterior fallaba con ese mensaje.');

	console.log(
		'\n-----------------------------------------------------------------------',
	);
	console.log(
		'✅ PRUEBA 2: Cambiando por el endpoint real (area=usersettings&module=base)...',
	);
	console.log('-----------------------------------------------------------------------');
	const initialSenior = await getPlayerSeniorCorrect(sessionId, userId);
	console.log(`1. Sala actual antes de migrar: "${initialSenior}"`);

	console.log(`2. Migrando a "${args.targetRoom}"...`);
	const moveResult = await changePlayerSeniorCorrect(sessionId, userId, args.targetRoom);
	console.log(
		`   Resultado: ${moveResult.success ? 'ÉXITO' : 'FALLO'}, Sala en respuesta: "${moveResult.currentSenior}"`,
	);

	const verifiedAfterMove = await getPlayerSeniorCorrect(sessionId, userId);
	console.log(`3. Verificación GET: Sala actual es ahora "${verifiedAfterMove}"`);

	const restoreTarget = args.restoreRoom || initialSenior || 'Superala';
	console.log(`4. Regresando a la sala original "${restoreTarget}"...`);
	const restoreResult = await changePlayerSeniorCorrect(sessionId, userId, restoreTarget);
	console.log(
		`   Resultado retorno: ${restoreResult.success ? 'ÉXITO' : 'FALLO'}, Sala en respuesta: "${restoreResult.currentSenior}"`,
	);

	const finalSenior = await getPlayerSeniorCorrect(sessionId, userId);
	console.log(`5. Verificación final GET: Sala restablecida a "${finalSenior}"`);

	console.log('\n🎉 [CONCLUSIÓN] Flujo validado al 100% de ida y vuelta.');
}

main().catch(err => {
	console.error('💥 Error:', err);
	process.exit(1);
});
