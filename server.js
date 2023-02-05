
const http = require('http');
const https = require('https');
const { Server: WebSocketServer } = require('ws');
const { promises: fs } = require('fs');
const { RefreshingAuthProvider } = require('@twurple/auth');
const { PubSubClient } = require('@twurple/pubsub');
const EasyMIDI = require('easymidi');
const mime = require('mime-types');

const CONFIG_ERROR = 'ConfigError';
const RETRY_RATE = 10; // in seconds
const TOKENS_FILE = './tokens.json';
const SCOPE = ['channel:read:redemptions'];

// Get configuration
require('./config.js');

// Twitch auth provider
let authProvider;

// Websocket server
let wsServer;

// Web server
let httpServer;

/**
 * Compare two scopes.
 * @param {array} scope1
 * @param {array} scope2
 * @return {boolean}
 */
function isSameScope(scope1, scope2) {
	return Array.isArray(scope1) && Array.isArray(scope2) && scope1.length == scope2.length && scope1.every(v => scope2.indexOf(v) >= 0);
}

/**
 * Indicates if the provided tokens object is valid.
 * @param {object} tokens
 * @returns
 */
function isTokenValid(tokens) {
	return tokens && tokens.accessToken && tokens.refreshToken && isSameScope(tokens.scope, SCOPE);
}

/**
 * Read local Twitch tokens.
 * @return {object}
 */
async function getTokens() {
	try {
		return JSON.parse(await fs.readFile(TOKENS_FILE, 'UTF-8'));
	} catch (e) {
		return {};
	}
}

/**
 * Write local Twitch tokens
 * @param {object} newTokenData
 */
async function setTokens(newTokenData) {
	await fs.writeFile(TOKENS_FILE, JSON.stringify({ ...await getTokens(), ...newTokenData }, null, 4), 'UTF-8');
}

/**
 * Get the updated configuration object for the front end.
 * @return {object}
 */
function getFrontEndConfig() {
	return {
		MIDI_IN: CONFIG.MIDI_IN || null,
		SOUNDS: CONFIG.SOUNDS || [],
	}
}

/**
 * Play the provided sound on the front end.
 * @param {object} sound
 */
function playSound(sound) {
	console.log(`Playing sound %s.`, sound.sound || sound.video);
	wsServer && wsServer.clients.forEach(client => client.send(JSON.stringify({
		type: 'play',
		data: sound
	})));
}

/**
 * Returns the root page to the web client
 * @param {URL} url
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 */
async function rootPage(url, req, res) {
	// Check Twitch tokens
	const tokens = await getTokens();

	// Twitch tokens are not valid: we need to proceed to the Twitch login
	if (!isTokenValid(tokens)) {
		const redirectUri = `http://${req.headers.host}/`;

		if (!url.searchParams.has('code') && !url.searchParams.has('scope')) {
			// Redirect to login page if coming without parameter
			const loginUrl = new URL('https://id.twitch.tv/oauth2/authorize');
			loginUrl.searchParams.set('client_id', CONFIG.CLIENT_ID);
			loginUrl.searchParams.set('redirect_uri', redirectUri);
			loginUrl.searchParams.set('response_type', 'code');
			loginUrl.searchParams.set('scope', SCOPE.join(' '));
			res.statusCode = 302;
			res.setHeader('Location', loginUrl.toString());
			res.end();
			console.log(`Twitch tokens not initialized: redirecting to login page.`, loginUrl.toString());
			return;

		} else {
			// Twitch oAuth parameters are provided: retrieve tokens
			const rawTokenData = await new Promise((resolve, reject) => {
				const tokenReqParams = new URLSearchParams({
					client_id: CONFIG.CLIENT_ID,
					client_secret: CONFIG.CLIENT_SECRET,
					code: url.searchParams.get('code'),
					grant_type: 'authorization_code',
					redirect_uri: redirectUri,
				});
				const tokenReq = https.request('https://id.twitch.tv/oauth2/token', { method: 'POST', port: 443, }, (tokenRes) => {
					let data = '';
					tokenRes.on('data', (d) => {
						data += d;
					});
					tokenRes.on('end', () => {
						if (tokenRes.statusCode === 200) {
							resolve(data);
						} else {
							reject(new Error(`Twitch returned the following error: ${data}`));
						}
					});
				});
				tokenReq.on('error', (e) => {
					reject(new Error(e));
				});
				tokenReq.write(tokenReqParams.toString());
				tokenReq.end();
			});

			// Set newly received tokens
			const twitchTokenData = JSON.parse(rawTokenData);
			await setTokens({
				accessToken: twitchTokenData.access_token,
				refreshToken: twitchTokenData.refresh_token,
				expiresIn: twitchTokenData.expires_in,
				scope: twitchTokenData.scope,
				tokenType: twitchTokenData.token_type,
				obtainmentTimestamp: 0,
			});

			// Start the Twitch bot
			await startTwitchBot();

			// Refresh the clients
			wsServer.clients.forEach(client => client.send(JSON.stringify({ type: 'ready' })));

			// Redirect to /
			res.statusCode = 302;
			res.setHeader('Location', redirectUri);
			res.end();
			console.log(`New Twitch tokens received: redirecting.`);

			return;
		}
	}

	// Serve the soundboard page
	res.statusCode = 200;
	res.setHeader('Content-Type', 'text/html; charset=utf-8');
	let html = await fs.readFile('./index.html', 'UTF-8');
	res.end(html);
}

/**
 * Start the Twitch bot
 */
async function startTwitchBot() {
	const tokenData = await getTokens();

	// Bot is already running
	if (authProvider) {
		return;
	}

	// Token is not valid
	if (!isTokenValid(tokenData)) {
		const url = `http://localhost:${CONFIG.HTTP_PORT}/`;
		console.warn(`Can't start Twitch bot, token data is invalid. Head to ${url} then proceed with Twitch login.`);
		return;
	}

	// Start Twitch bot
	try {
		authProvider = new RefreshingAuthProvider({
			clientId: CONFIG.CLIENT_ID,
			clientSecret: CONFIG.CLIENT_SECRET,
			onRefresh: setTokens
		}, tokenData);
	} catch (error) {
		console.warn(`Can't start the Twitch bot:`, error);
		return;
	}

	// Listen to channel points rewards
	const pubSubClient = new PubSubClient();
	const userId = await pubSubClient.registerUserListener(authProvider);

	await pubSubClient.onRedemption(userId, (message) => {
		console.log(`%s redeemed %s`, message.userName, message.rewardTitle);
		// Find reward sound and play it
		CONFIG.SOUNDS
			.filter(sound => sound.rewardId === message.rewardId)
			.forEach(playSound);
	});

	console.log(`Twitch bot started.`);
}

/**
 * Starts the web server
 */
async function startWebServer() {
	httpServer = http.createServer(async (req, res) => {
		const url = new URL(`http://${req.headers.host}${req.url}`);
		try {
			switch (url.pathname) {
				// Main page
				case '/':
				case '/index.html':
					await rootPage(url, req, res);
					break;

				// Scripts
				case '/config.js':
				case '/soundboard.js':
				case '/libgif-js/libgif.js':
				case '/libgif-js/rubbable.js':
					res.statusCode = 200;
					res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
					res.end(await fs.readFile(`.${url.pathname}`, 'UTF-8'));
					break;

				// Stylesheets
				case '/style.css':
					res.statusCode = 200;
					res.setHeader('Content-Type', 'text/css; charset=utf-8');
					res.end(await fs.readFile(`.${url.pathname}`, 'UTF-8'));
					break;

				// Favicons
				case '/favicon.ico':
					res.statusCode = 200;
					res.setHeader('Content-Type', 'image/x-icon');
					res.end(await fs.readFile(`.${url.pathname}`));
					break;

				// Assets
				default:
					const assetMatches = url.pathname.match(/^\/assets\/(.+)$/);
					if (assetMatches) {
						const contentType = mime.contentType(assetMatches[1]);
						if (contentType) {
							res.setHeader('Content-Type', contentType);
						}
						res.end(await fs.readFile(`./assets/${assetMatches[1]}`, null));
						break;
					} else {
						res.statusCode = 404;
						res.end('HTTP error 404 - Resource not found\n');
					}
			}
		} catch (error) {
			res.statusCode = 500;
			res.end(`HTTP error 500 - ${error.message}`);
		}
	});

	httpServer.listen(CONFIG.HTTP_PORT, 'localhost', async () => {
		console.log(`HTTP server running at http://localhost:${CONFIG.HTTP_PORT}/.`);
	});
}

/**
 * Start the web socket server
 */
async function startWsServer() {
	wsServer = new WebSocketServer({ port: CONFIG.WS_PORT });
	wsServer.on('connection', async (client) => {
		console.log(`New WebSocket client connected!`);

		client.on('close', () => console.log(`WebSocket client has disconnected!`));

		// Send updated config to the client
		client.send(JSON.stringify({ type: 'config', data: getFrontEndConfig() }));

		// The Twitch bot is not running, we may need to login to Twitch again
		if (!authProvider) {
			console.log(`Redirecting client to Twitch login.`);
			client.send(JSON.stringify({ type: 'login' }));
		} else {
			// The server is fully ready
			client.send(JSON.stringify({ type: 'ready' }));
		}
	});
}

/**
 * Start MIDI controller
 */
async function startMIDI() {
	if (!CONFIG.MIDI_IN) {
		console.log(`MIDI_IN not set in config.js, not using MIDI.`);
		console.log(`Available MIDI ports:`);
		EasyMIDI.getInputs().forEach(name => console.log(`\t${name}`));
		return;
	}
	try {
		const input = new EasyMIDI.Input(CONFIG.MIDI_IN);
		input.on('noteon', (msg) => {
			const note = msg.note;
			const channel = msg.channel + 1
			console.log(`Note ON %s on channel %s.`, note, channel);
			// Find Note ON sound and play it
			CONFIG.SOUNDS
				.filter(sound => sound.note && sound.note === msg.note && (!sound.channel || sound.channel === channel))
				.forEach(playSound);
		});
		console.log(`MIDI port %s open.`, CONFIG.MIDI_IN);
	} catch (error) {
		console.warn(`MIDI failed to start port %s: %s`, CONFIG.MIDI_IN, error.message);
	}
}

/**
 * Init the server app
 */
async function initApp() {
	// Check HTTP port
	if (!CONFIG.HTTP_PORT) {
		const error = new Error(`HTTP_PORT missing is in config.js.`);
		error.name = CONFIG_ERROR;
		throw error;
	}

	// Check WS port
	if (!CONFIG.WS_PORT) {
		const error = new Error(`WS_PORT missing is in config.js.`);
		error.name = CONFIG_ERROR;
		throw error;
	}

	// Check Twitch client ID
	if (!CONFIG.CLIENT_ID) {
		const error = new Error(`Twitch app CLIENT_ID is missing in config.js.`);
		error.name = CONFIG_ERROR;
		throw error;
	}

	// Check Twitch client secret
	if (!CONFIG.CLIENT_SECRET) {
		const error = new Error(`Twitch app CLIENT_SECRET is missing in config.js.`);
		error.name = CONFIG_ERROR;
		throw error;
	}

	// Start Twitch bot
	await startTwitchBot();

	// Start MIDI
	await startMIDI();

	// Start HTTP server
	await startWebServer();

	// Start WS server
	await startWsServer();
}

/**
 * Starts the server app.
 * Attempts to restart in case of error.
 */
async function startApp() {
	try {
		await initApp();
	} catch (error) {
		console.error(`The server app failed to start:`, error.message);
		if (error.name !== CONFIG_ERROR) {
			console.log(`Retrying in 10 seconds...`);
			setTimeout(startApp, RETRY_RATE * 10000);
		}
	}

}

// Start the server app!
startApp();