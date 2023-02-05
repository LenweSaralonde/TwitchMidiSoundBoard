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
	// This array defines the available sounds for your sound board. All the accepted object properties optional:
	// - rewardId: Twitch reward ID (format 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx')
	// - note: MIDI note number (0-127)
	// - channel: MIDI channel (1-16) (if not set, the note may come from any MIDI channel)
	// - gif: GIF animation to play
	// - sound: Audio file to play
	// - video: Video file to play
	SOUNDS: [
		// Badum tss
		{
			rewardId: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
			note: 36,
			channel: 10,
			gif: 'badum-tss.gif',
			sound: 'badum-tss.mp3',
		},
	]
}