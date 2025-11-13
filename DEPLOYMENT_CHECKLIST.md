# Deployment Checklist - Render + Slack Translation App

## ✅ Pre-Deployment Verification

### Files Required (All Present)
- [x] `server.ts` - Main webhook server (self-contained, no dependencies)
- [x] `Dockerfile` - Docker configuration for Deno
- [x] `render.yaml` - Render platform configuration
- [x] `.gitignore` - Git ignore rules
- [x] `.dockerignore` - Docker ignore rules

### Code Verification
- [x] Language mapping embedded in server.ts
- [x] Flag reaction detection (`flag-jp`, `flag-fr`, etc.)
- [x] Direct reaction support (`jp`, `fr`, etc.)
- [x] Slack webhook signature verification
- [x] DeepL API integration
- [x] Error handling
- [x] Duplicate translation prevention

## 🚀 Deployment Steps

### Step 1: Push to GitHub
1. Ensure all files are committed
2. Push to your GitHub repository
3. Verify `server.ts` is in the repository

### Step 2: Deploy to Render
1. Go to https://render.com
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository
4. Configure:
   - **Name**: `deepl-for-slack` (or your choice)
   - **Region**: `Singapore (Southeast Asia)` (or your preference)
   - **Branch**: `master` (or `main`)
   - **Language**: **Docker** ⚠️ (NOT Deno - Render doesn't have it)
   - **Dockerfile Path**: `./Dockerfile` (or leave empty if using render.yaml)
   - **Plan**: Free
5. Add Environment Variables:
   - `DEEPL_AUTH_KEY` - Your DeepL API key (starts with `...:fx` for free tier)
   - `SLACK_BOT_TOKEN` - Your Slack bot token (starts with `xoxb-`)
   - `SLACK_SIGNING_SECRET` - Your Slack app signing secret
   - `DEEPL_TARGET_LANG` - Optional (not used but won't hurt)
6. Click **"Create Web Service"**
7. Wait for deployment to complete
8. **Copy your service URL** (e.g., `https://deepl-for-slack.onrender.com`)

### Step 3: Configure Slack App
1. Go to https://api.slack.com/apps
2. Select your Slack app
3. Go to **"Event Subscriptions"**
4. Enable **"Enable Events"**: ON
5. Set **"Request URL"**: `https://your-service-name.onrender.com/slack/events`
   - Replace `your-service-name` with your actual Render service name
   - Slack will verify the URL (your server handles this automatically)
6. Under **"Subscribe to bot events"**, click **"Add Bot User Event"**
7. Add: `reaction_added`
8. Click **"Save Changes"**
9. Go to **"OAuth & Permissions"**
10. Verify these scopes are added:
    - `chat:write`
    - `channels:history`
    - `groups:history`
    - `reactions:read`
11. If scopes are missing, add them and **"Reinstall to Workspace"**

### Step 4: Test
1. Add your bot to a Slack channel
2. Post a message in the channel
3. Add a flag reaction (🇯🇵, 🇫🇷, 🇪🇸, etc.) to the message
4. The bot should translate and post a reply in the thread

## 🔍 Troubleshooting

### Deployment Fails
- Check Render logs for errors
- Verify `server.ts` is in the repository
- Ensure Dockerfile is correct

### Slack Verification Fails
- Check that your Render service is live
- Verify the Request URL is exactly: `https://your-service.onrender.com/slack/events`
- Check Render logs for errors

### Translations Don't Work
- Verify bot is in the channel
- Check `reaction_added` event is subscribed
- Check Render logs for errors
- Verify environment variables are set correctly
- Test with a simple flag like 🇯🇵 (`:flag-jp:`) or 🇫🇷 (`:flag-fr:`)

### "Unhandled HTTP request" Messages
- This is normal for health checks
- If you see it for `/slack/events`, check Slack app configuration

## 📋 Environment Variables Summary

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `DEEPL_AUTH_KEY` | ✅ Yes | DeepL API key | `abc123:fx` |
| `SLACK_BOT_TOKEN` | ✅ Yes | Slack bot token | `xoxb-1234...` |
| `SLACK_SIGNING_SECRET` | ✅ Yes | Slack signing secret | `abc123...` |
| `PORT` | ❌ No | Auto-set by Render | `10000` |
| `DEEPL_TARGET_LANG` | ❌ No | Not currently used | Optional |

## ✅ Final Verification

Before considering deployment complete:
- [ ] Render service shows "Live" status
- [ ] Health check works: `https://your-service.onrender.com/` returns "OK"
- [ ] Slack app Request URL verified (green checkmark)
- [ ] `reaction_added` event subscribed
- [ ] Bot added to test channel
- [ ] Test translation works with flag reaction

## 🎉 Success Indicators

You'll know it's working when:
- ✅ Render deployment succeeds
- ✅ Slack app shows verified Request URL
- ✅ Adding a flag reaction triggers translation
- ✅ Translation appears as thread reply
- ✅ No errors in Render logs

