global.CONFIG = {
	// HTTP server port
	HTTP_PORT: 8666,

	// WS server port
	WS_PORT: 8667,

	// Twitch application client ID
	CLIENT_ID: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',

	// Twitch application client secret
	CLIENT_SECRET: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',

	// MIDI in device (optional)
	MIDI_IN: 'LPD8 mk2',

	// Sounds
	SOUNDS: [
		// Badum tss
		{
			rewardId: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', // Twitch reward ID (Optional, if you want to use with sound with MIDI only.)
			note: 36, // MIDI note 0-127 (Optional, if you want to use this sound as a Twitch reward only.)
			channel: 10, // MIDI channel 1-16 (Optional, if not set, the note may come from any MIDI channel.)
			image: 'badum-tss.gif', // GIF file to play along with the sound.
			sound: 'badum-tss.mp3' // Audio file to play
		},
	]
}