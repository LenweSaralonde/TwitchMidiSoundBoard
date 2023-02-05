let CONFIG = global.CONFIG;

let webSocket; // web socket to the server
let tryReconnectWebSocketTimeout; // timeout to automatically reconnect to the WS
let zIndex = 0;

let sounds = new Map(); // Audio players
let gifs = new Map(); // GIF players

/**
 * Preload all sounds from config
 */
function preloadSounds() {
	// Remove all sounds
	for (let [key, sound] of sounds) {
		sound.stop();
		sounds.delete(key);
	};

	// Remove all GIFs
	for (let [key, gif] of gifs) {
		gif.stop();
		gif.remove();
		gifs.delete(key);
	};

	// Add new elements
	for (const sound of CONFIG.SOUNDS) {
		// Audio element
		if (sound.sound) {
			const audio = new Audio('assets/' + sound.sound);
			const loadPromise = new Promise(resolve => audio.addEventListener('canplaythrough', resolve));
			const play = () => {
				audio.currentTime = 0;
				audio.play();
			};
			const stop = () => audio.pause();
			sounds.set(sound.sound, { audio, loadPromise, play, stop });
		}

		// GIF element
		if (sound.gif) {
			// Create GIF container
			const div = document.createElement('div');
			div.classList.add('hidden');
			content.append(div);

			// Create GIF img tag
			const img = document.createElement('img');
			div.append(img);

			// Create GIF player
			const gif = new SuperGif({
				gif: img,
				auto_play: false,
				loop_mode: false,
				progressbar_height: 0,
				on_end: function () {
					div.classList.remove('visible');
					div.classList.add('hidden');
				}
			});

			// Load GIF as promise
			const loadPromise = new Promise(resolve => gif.load_url(`assets/${sound.gif}`, () => {
				// Resize canvas size to match container size
				const canvas = gif.get_canvas();
				const viewportRatio = content.clientWidth / content.clientHeight;
				const canvasRatio = canvas.width / canvas.height;
				if (viewportRatio > canvasRatio) {
					// Viewport wider than the image: set max height
					canvas.style.width = `${content.clientHeight * canvasRatio}px`;
					canvas.style.height = `${content.clientHeight}px`;
					canvas.style.left = `${(content.clientWidth - content.clientHeight * canvasRatio) / 2}px`;
				} else {
					// Image wider than the viewport: set max width
					canvas.style.width = `${content.clientWidth}px`;
					canvas.style.height = `${content.clientWidth / canvasRatio}px`;
					canvas.style.top = `${(content.clientHeight - content.clientWidth / canvasRatio) / 2}px`;
				}

				// GIF is ready to play
				resolve();
			}));

			const play = () => {
				div.classList.remove('hidden');
				div.classList.add('visible');
				zIndex++;
				div.style.zIndex = zIndex;
				gif.move_to(0);
				gif.play();
			}
			const stop = () => {
				div.classList.add('hidden');
				gif.pause();
			}
			const remove = () => div.remove();
			gifs.set(sound.gif, { gif, loadPromise, play, stop, remove });
		}
	}
}

/**
 * Play a previously preloaded sound
 * @param {object} sound
 */
async function playSound(sound) {
	const loadPromises = [];
	const playFunctions = [];

	// Audio element
	if (sound.sound && sounds.has(sound.sound)) {
		loadPromises.push(sounds.get(sound.sound).loadPromise);
		playFunctions.push(sounds.get(sound.sound).play);
	}

	// GIF element
	if (sound.gif && gifs.has(sound.gif)) {
		loadPromises.push(gifs.get(sound.gif).loadPromise);
		playFunctions.push(gifs.get(sound.gif).play);
	}

	// Make sure all assets have finished loading
	await Promise.all(loadPromises);

	// Play audio and video
	for (const play of playFunctions) {
		play();
	}
}

function displayError(message) {
	const messageElement = document.querySelector("#message");
	messageElement.innerHTML = message;
	messageElement.classList.remove('message');
	messageElement.classList.add('error');
	messageElement.classList.remove('hidden');
	document.querySelector("#content").classList.add('hidden');
}

function displayMessage(message) {
	const messageElement = document.querySelector("#message");
	messageElement.innerHTML = message;
	messageElement.classList.add('message');
	messageElement.classList.remove('error');
	messageElement.classList.remove('hidden');
	document.querySelector("#content").classList.add('hidden');
}

function hideMessage() {
	const messageElement = document.querySelector("#message");
	messageElement.innerHTML = '';
	messageElement.classList.add('hidden');
	document.querySelector("#content").classList.remove('hidden');
}

function connectWS() {
	// Web socket is already connected
	if (webSocket && webSocket.readyState !== 3) {
		return;
	}

	const wsUrl = `ws://localhost:${CONFIG.WS_PORT}`;

	console.log(`WS connecting to: %s`, wsUrl);

	webSocket = new WebSocket(wsUrl);

	const removeListeners = function () {
		webSocket.removeEventListener('open', onWSOpen);
		webSocket.removeEventListener('close', onWSClose);
		webSocket.removeEventListener('close', removeListeners);
		webSocket.removeEventListener('error', onWSError);
		webSocket.removeEventListener('error', removeListeners);
		webSocket.removeEventListener('message', onWSMessage);
	}

	webSocket.addEventListener('open', onWSOpen);
	webSocket.addEventListener('close', onWSClose);
	webSocket.addEventListener('close', removeListeners);
	webSocket.addEventListener('message', onWSMessage);
	webSocket.addEventListener('error', onWSError);
	webSocket.addEventListener('error', removeListeners);
}

function tryReconnectWS() {
	displayError(`The soundboard server is not running.`);
	console.log(`Try reconnecting the WS...`);
	if (tryReconnectWebSocketTimeout) {
		clearTimeout(tryReconnectWebSocketTimeout);
		tryReconnectWebSocketTimeout = null;
	};
	tryReconnectTimeout = setTimeout(connectWS, 1000);
}

function onWSOpen(event) {
	console.info(`WS connected!`, event);
}

function onWSClose(event) {
	console.warn(`WS connection was closed!`, event);
	tryReconnectWS();
}

function onWSError(event) {
	console.warn(`WS connection error!`, event);
	tryReconnectWS();
}

function onWSMessage(event) {
	const url = `http://localhost:${CONFIG.HTTP_PORT}/`;
	const message = JSON.parse(event.data);
	console.log(`WS incoming message`, message);

	switch (message.type) {
		case 'play':
			// Play sound
			if (window.location.href === url) {
				playSound(message.data);
			}
			break;

		case 'config':
			// Update config
			const config = message.data;
			Object.assign(CONFIG, config);
			preloadSounds();
			console.log(`Configuration updated.`);
			break;

		case 'login':
			// Go to Twitch login, if possible
			if (window.obsstudio) {
				displayError(`Go to <u>${url}</u> with your browser to log into Twitch.`);
			} else {
				window.location.href = url;
			}
			break;

		case 'ready':
			// Connection with WS is ready
			hideMessage();

			// Reload page if needed
			if (window.location.href !== url) {
				window.location.href = url;
			}
			break;
	}
}

window.addEventListener('load', function () {
	if (!CONFIG.HTTP_PORT || !CONFIG.WS_PORT) {
		displayError(`Invalid configuration&nbsp;!`);
	} else {
		displayMessage(`Starting soundboard...`);
		preloadSounds();
		connectWS();
	}
});