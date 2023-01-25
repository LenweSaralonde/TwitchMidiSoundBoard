# TwitchMidiSoundBoard

Sound board for OBS Browser Source controlled via MIDI and Twitch channel point rewards.

## TODO

* Proper player that supports GIFs, video and audio files, stretched to fit the viewport size.
* Write documentation.

## Installation

### Create your Twitch app

1. Follow the instructions from https://twurple.js.org/docs/examples/chat/basic-bot.html
2. Get client ID and client secret.

### Create your Twitch rewards

1. Open your Twitch.tv dashboard.
2. Head to **Viewer rewards** / **Channel points**.
3. Click **Manage Rewards & Challenges**.
4. Add New Custom Reward.
5. Set a name, amount and description, as you like.
6. Check **Skip Reward Requests Queue**.
7. Click **Create** when you're done.
8. Right click on the **Edit** button of the reward you just created then choose **Inspect**.
9. Copy the value of the `data-reward-id` attribute of the `<button>` tag to get the reward ID.

### Install the server application

1. Install [Node.js](https://nodejs.org/en/).
2. Type `npm i` to install the Node.js server application.
3. Copy your media files into the `assets` folder.
4. Copy `config-example.js` to `config.js`.
5. Edit the `config.js` config file to set the parameters for your Twitch app, your MIDI controller and create your soundboard.
6. Launch the server application with `npm run start`.
7. Open the `index.html` file with your browser then log into Twitch login.
8. Click **Accept** to give rights to your application.

### Set the browser source

1. Add a new browser source in OBS.
2. Check **Local file** and select the `index.html` file.
3. Set the position and size you like.
4. Click OK

## How to use

Launch the server application with `npm run start` along with OBS. An error message will show up in place of the soundboard in case of problem such as the server application not running or the Twitch app not connected.

If you made some modifications in your `config.js` file, restart the server application. If you changed `HTTP_PORT` or `WS_PORT`, you'll need restart your browser source and clear its cache as well.