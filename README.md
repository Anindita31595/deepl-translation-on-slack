## DeepL Translation APP for Slack

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

* Select "DeepL API Free" plan at https://www.deepl.com/ja/pro-api? page to create DeepL API account.
* Go to your [DeepL Pro Account](https://www.deepl.com/pro-account.html) page
* Save the **Authentication Key for DeepL API** value

Refer to the following resources for more details:

* https://www.deepl.com/docs-api/

**Please note that API accounts are different from DeepL's regular accounts**.
Even when you already have an account for using the text translation on the
website, a separate account for API access needs to be created.

Once you create your API account, copy the API token string on
[the account summary page](https://www.deepl.com/account/summary), which is used
for the next section.

### Create your Slack App

Go to https://api.slack.com/apps/ to create your slack app

<img height="500"" alt="slack_app_creation" src="https://github.com/user-attachments/assets/292935fc-fc00-4d7a-83e9-27b511317d11" />

  * Click **Create New App** button
  * Click **From Scratch** button
    
    <img height="500" alt="slack_app_creation_S1" src="https://github.com/user-attachments/assets/c51e642f-370a-4807-8acf-73bf7bf23052" />
    
  * Write a name for your App and select a workspace to develop your app
  * Click on **Create App* button
    
    <img height="500" alt="slack_app_creation_S2" src="https://github.com/user-attachments/assets/ed03443e-6f82-4fa1-95ba-18b14323086d" />
 
* Click on the App Name (DeepL Translation)

  <img height="500" alt="slack_app_creation_S3" src="https://github.com/user-attachments/assets/dc43e386-5425-4d45-945e-58ba23548ef6" />
  
* Go to **Settings > Basic Information** in the left pane
  * Scroll down to **App Credentials** section
  * Click **Show** button in **Signing Secret** section
  * Save the **Signing Secret** value

*Once the app is created, go to **Features > OAuth & Permissions** from the left pane, then **Scopes > Bot Token Scopes** and add the following:
  * channels:history- Used to view messages with reactions and to view the history to avoid duplicate posts in a thread
  * groups:history- Same as above (not necessary if not using a private channel
  * channels:join- Used to join public channels in a workspace
  * chat:write- Used to write translation results to a channel
  * im:history-  Used to view messages and other contents in direct messages that the App has been added to
  * mpim:history-  Used to view messages and other contents in group direct messages that the App has been added to
  * reactions:read- Used to subscribe to events with reactions
  * reactions:write- Used to add and edit reactions
    
 <img src="https://qiita-user-contents.imgix.net/https%3A%2F%2Fqiita-image-store.s3.ap-northeast-1.amazonaws.com%2F0%2F19163%2F20e05acc-8820-5fde-9900-364aef7fd354.gif?ixlib=rb-4.0.0&amp;auto=format&amp;gif-q=60&amp;q=75&amp;s=cb1caae3497292f6f9b75734aa5f40e1" width="600" srcset="https://qiita-user-contents.imgix.net/https%3A%2F%2Fqiita-image-store.s3.ap-northeast-1.amazonaws.com%2F0%2F19163%2F20e05acc-8820-5fde-9900-364aef7fd354.gif?ixlib=rb-4.0.0&amp;auto=format&amp;gif-q=60&amp;q=75&amp;w=1400&amp;fit=max&amp;s=95f9435f46fc23659626f680face1a30 1x" data-canonical-src="https://qiita-image-store.s3.ap-northeast-1.amazonaws.com/0/19163/20e05acc-8820-5fde-9900-364aef7fd354.gif" loading="lazy">

If you've set it up correctly, it should look like this:

<img height="500" alt="slack_app_creation_S4" src="https://github.com/user-attachments/assets/b49de160-ad26-4394-9117-74838ece25e8" />

**Bot configuration**
Set the name of your bot. 
Go to **Features > App Home** from the left pane. Click the Edit button next to App Display Name and set it.


The name can be anything, but it might be a good idea to give it an easy-to-remember name like "Translation-kun."


* Go to **Settings > Install App** in the left pane
  * Click **Install App to Workspace** button
  * Click **Allow** button in the OAuth confirmation page
  * Save the **Bot User OAuth Access Token** value (xoxb-***)

### Deploy to Render

* Go to 👉 https://render.com
  * Click “New +” → “Web Service”
  * Connect your GitHub account (if not already)
  * Select your github repository (deepl-translation-on-slack)

**Configure:**

 - Name: deepl-translation-on-slack
 - Region: any/Singapore (fastest for Japan)
 - Branch: main
 - Language: Docker
 - Dockerfile path: ./Dockerfile
   
Click “Create Web Service”

**Add Environment Variables**

Once it deploys, click “Environment” in Render’s left panel.
Add these variables:
Key	Value
- `DEEPL_AUTH_KEY` (from your DeepL free API account)
- `SLACK_CLIENT_SECRET`	(from your Slack app → Basic Information)
- `SLACK_BOT_TOKEN` (from your Slack app → OAuth & Permissions)
- `PORT` Automatically set by hosting platform

Click Save Changes.

For detailed instructions, see [DEPLOYMENT.md](./DEPLOYMENT.md).\

**Copy Your Render URL**

After deployment, you’ll get a live URL, something like:
https://deepl-slack-app.onrender.com

Then, in your Slack App Dashboard → OAuth & Permissions,
add this to Redirect URLs:
https://deepl-slack-app.onrender.com/slack/oauth_redirect

Save the changes.

**Reinstall App in Slack**

Go back to your Slack app page → OAuth & Permissions

Click Reinstall to Workspace

Authorize it again — Slack will now talk to your Render server.

## Configuration

### Slack App Setup 

After deploying, configure your Slack app:

1. Go to https://api.slack.com/apps
2. Select your app
3. Go to **Event Subscriptions**
4. Enable Event Subscriptions
5. Set **Request URL** to: `https://your-app.onrender.com/slack/events`
6. Under **Subscribe to bot events**, add: `reaction_added`
7. Save changes

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
