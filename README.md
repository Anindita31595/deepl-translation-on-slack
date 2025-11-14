## DeepL App for Slack

DeepL for Slack is a Slack integration that enables end-users to translate channel messages into a different lanuage just by adding reaction emoji.

## Features

### Shortcut to run DeepL Translate API

Slack users can run DeepL Translate API in a modal.

<img src="https://user-images.githubusercontent.com/19658/84773721-cb505f80-b017-11ea-8c41-aed57012ab8b.gif" height="500">

### Post a translated text in thread

This works mostly the same as [reacjilator](https://github.com/slackapi/reacjilator).

<img src="https://user-images.githubusercontent.com/19658/84773773-dc996c00-b017-11ea-9022-017492a7c9df.gif" height="500">

## Prerequisites

To run this app, the following accounts are required.

* DeepL free API account
* Slack workspace and user account
* Render: Cloud application platform free account 

If you already have all of them, setting up this app requires only 5 minutes.

## Set up

### Create DeepL API Account

* Select "for Developers" plan at https://www.deepl.com/pro/ (be careful not to choose any other)
* Go to your [DeepL Pro Account](https://www.deepl.com/pro-account.html) page
* Save the **Authentication Key for DeepL API** value

Refer to the following resources for more details:

* https://www.deepl.com/en/pro/
* https://www.deepl.com/docs-api/

**Please note that API accounts are different from DeepL's regular accounts**.
Even when you already have an account for using the text translation on the
website, a separate account for API access needs to be created.

Once you create your API account, copy the API token string on
[the account summary page](https://www.deepl.com/account/summary), which is used
for the next section.

### Create your Slack App

Use the [App Manifest file](https://github.com/seratch/deepl-for-slack/blob/master/app-manifest.yml) to configure a new app!

<img width="400" src="https://user-images.githubusercontent.com/19658/121115984-cef47c00-c850-11eb-9d7e-dbd80407ac9a.png">
<img width="400" src="https://user-images.githubusercontent.com/19658/121115976-cc922200-c850-11eb-8e23-1054c48b54d0.png">
<img width="400" src="https://user-images.githubusercontent.com/19658/121115986-cf8d1280-c850-11eb-8f7f-9d59112df42b.png">
<img width="400" src="https://user-images.githubusercontent.com/19658/121115989-d025a900-c850-11eb-9cb7-35fc979a81f8.png">

* Got to **Settings > Install App** in the left pane
  * Click **Install App to Workspace** button
  * Click **Allow** button in the OAuth confirmation page
  * Save the **Bot User OAuth Access Token** value (xoxb-***)

* Go to **Settings > Basic Information** in the left pane
  * Scroll down to **App Credentials** section
  * Click **Show** button in **Signing Secret** section
  * Save the **Signing Secret** value




#### Development Environment Variables

When [developing locally](https://api.slack.com/automation/run), environment
variables found in the `.env` file at the root of your project are used. For
local development, rename `.env.sample` to `.env` and add your access token to
the file contents (replacing `ACCESS_TOKEN` with your token):

```bash
# .env
DEEPL_AUTH_KEY=ACCESS_TOKEN
```

#### Production Environment Variables

[Deployed apps](https://api.slack.com/automation/deploy) use environment
variables that are added using `slack env`. To add your access token to a
Workspace where your deployed app is installed, use the following command (once
again, replacing `ACCESS_TOKEN` with your token):

```zsh
$ slack env add DEEPL_AUTH_KEY YOUR_ACCESS_TOKEN
```

## Running Your Project Locally

To test the app locally before deploying:

1. Create a `.env` file with your environment variables:
   ```
   DEEPL_AUTH_KEY=your_key_here
   SLACK_BOT_TOKEN=xoxb-your-token
   SLACK_SIGNING_SECRET=your_secret
   PORT=3000
   ```

2. Run the server:
   ```zsh
   deno run --allow-net --allow-env server.ts
   ```

3. Use a tool like [ngrok](https://ngrok.com/) to expose your local server:
   ```zsh
   ngrok http 3000
   ```

4. Set the ngrok URL as your Slack app's Request URL (temporarily for testing)

To stop the server, press `<CTRL> + C`.

## Usage

Once the app is deployed and configured:

1. **Add the bot to your Slack channels** where you want translations
2. **Add a flag reaction** (🇯🇵, 🇫🇷, 🇪🇸, etc.) or country code reaction (`:jp:`, `:fr:`, `:es:`, etc.) to any message
3. The app will automatically translate the message and post it as a thread reply

**Supported Reactions:**
- Flag emojis: `:flag-jp:`, `:flag-fr:`, `:flag-es:`, etc.
- Country codes: `:jp:`, `:fr:`, `:es:`, `:de:`, etc.

The app supports 100+ languages. See `functions/detect_lang.ts` for the complete list.

<img width="600" src="https://user-images.githubusercontent.com/19658/206638194-6eff88fa-05c1-4308-a180-0a547890aab6.png">

## Configuration

### Slack App Setup

After deploying, configure your Slack app:

1. Go to https://api.slack.com/apps
2. Select your app
3. Go to **Event Subscriptions**
4. Enable Event Subscriptions
5. Set **Request URL** to: `https://your-app-url.com/slack/events`
6. Under **Subscribe to bot events**, add: `reaction_added`
7. Save changes

### Environment Variables

Required environment variables:
- `DEEPL_AUTH_KEY` - Your DeepL API key
- `SLACK_BOT_TOKEN` - Your Slack bot token (starts with `xoxb-`)
- `SLACK_SIGNING_SECRET` - Your Slack app's signing secret
- `PORT` - Automatically set by hosting platform

## Deploying Your App

This app is configured for Docker deployment to external hosting platforms. The app uses webhooks to handle Slack Events API requests.

**Supported Platforms:**
- **Render** (Free tier available) - Recommended, see setup below
- **Railway** - See [DEPLOYMENT.md](./DEPLOYMENT.md) for setup
- **Fly.io** - See [DEPLOYMENT.md](./DEPLOYMENT.md) for setup
- **Deno Deploy** - See [DEPLOYMENT.md](./DEPLOYMENT.md) for setup

**Quick Start for Render (Recommended):**
1. Push your code to GitHub
2. Connect your repository to Render
3. Select **Docker** as the runtime
4. Set Dockerfile path to `./Dockerfile`
5. Add environment variables:
   - `DEEPL_AUTH_KEY` - Your DeepL API key
   - `SLACK_BOT_TOKEN` - Your Slack bot token (starts with `xoxb-`)
   - `SLACK_SIGNING_SECRET` - Your Slack signing secret
6. Configure your Slack app's Event Subscriptions:
   - Request URL: `https://your-app.onrender.com/slack/events`
   - Subscribe to `reaction_added` event

For detailed instructions, see [DEPLOYMENT.md](./DEPLOYMENT.md).

## Viewing Activity Logs

Activity logs of your application can be viewed live and as they occur with the
following command:

```zsh
$ slack activity --tail
```

## Project Structure

### `server.ts`

The main webhook server for Docker deployments. This file handles Slack Events API
webhooks and processes `reaction_added` events to translate messages. It includes:
- Slack request signature verification
- Event handling for reactions
- DeepL API integration for translations
- Message posting to Slack threads

### `functions/`

Contains the language detection logic:
- `detect_lang.ts` - Language mapping from flag reactions to language codes
- `internals/debug_mode.ts` - Debug utilities

### `Dockerfile`

Docker configuration file for deploying the app to containerized hosting platforms.
Uses the official Deno image to run the `server.ts` webhook server.

### `render.yaml`

Render platform configuration file. Defines the service settings, environment variables,
and deployment configuration for Render.

### `assets/`

Contains app icons and other static assets.

## Resources

To learn more about developing automations on Slack, visit the following:

- [Automation Overview](https://api.slack.com/automation)
- [CLI Quick Reference](https://api.slack.com/automation/cli/quick-reference)
- [Samples and Templates](https://api.slack.com/automation/samples)
