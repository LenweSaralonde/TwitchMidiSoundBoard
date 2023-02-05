# TwitchMidiSoundBoard

Sound board for OBS Browser Source controlled via MIDI and Twitch channel point rewards.

## Installation

### Create your Twitch app

1. Go to your [Twitch developer console](https://dev.twitch.tv/console/apps).
2. Create a new application. Set `http://localhost:8666/` as **OAuth redirect URL**.
3. When done, write down **Client ID** and **Client Secret** somewhere, you're gonna need them later!

### Create your Twitch rewards

1. Open your [Twitch.tv](https://twitch.tv) stream manager.
2. Head to **Viewer rewards** / **Channel points**.
3. Click **Manage Rewards & Challenges**.
4. Add a New Custom Reward.
5. Set a name, amount and description, as you like.
6. Check **Skip Reward Requests Queue**.
7. Click **Create** when you're done.
8. Right click on the **Edit** button of the reward you just created then choose **Inspect**.
9. Copy the value of the `data-reward-id` attribute of the `<button>` tag to get the reward ID.

### Install the server application

1. Install [Node.js](https://nodejs.org/).
2. Open a terminal in the folder and type `npm i` to install the Node.js server application or run `install.bat` (Windows only).
3. Copy your media files into the `assets` folder.
4. Copy `config-example.js` to `config.js`.
5. Edit the `config.js` config file to set the parameters for your Twitch app, your MIDI controller and create your soundboard. Read the instructions in the config file to learn more.
6. Launch the server application by typing `npm run start` or run `start.bat` (Windows only).
7. Open the `index.html` file in your browser then log into Twitch.
8. Click **Accept** to give the needed rights to your application.

### Set the browser source

1. Add a new browser source in OBS.
2. Check **Local file** and select the `index.html` file.
3. Set the position and size you like.
4. Click OK.

## How to use

Launch the server application with `npm run start` or `start.bat` (Windows) along with OBS. An error message will show up in place of the soundboard in case of problem such as the server application not running or the Twitch app not being connected.

If you made some modifications in your `config.js` file, just restart the server application, no need to restart the browser source. If you changed `HTTP_PORT` or `WS_PORT`, you'll need restart your browser source and refresh its cache as well.

Refresh the browser source cache in case the alerts don't play correctly.