let CONFIG = global.CONFIG;

let webSocket; // web socket to the server
let tryReconnectWebSocketTimeout; // timeout to automatically reconnect to the WS

function playSound(sound) {
	// TODO
	const audio = new Audio('assets/' + sound.sound);
	audio.play();
	document.querySelector("#content").innerHTML = `<img src="assets/${sound.image}" style="width: 100vw; max-height: 100wh">`;
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
		connectWS();
	}
});