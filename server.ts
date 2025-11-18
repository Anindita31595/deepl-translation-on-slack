// Note: This file uses Deno APIs and will work correctly when run with Deno (via Docker on Render).
// Language mapping from reaction names to DeepL language codes
const allReactionToLang: Record<string, string> = {
  ac: "en", ag: "en", ai: "en", ao: "pt", ar: "es", as: "en", at: "de", au: "en",
  aw: "nl", bb: "en", be: "nl", bf: "fr", bi: "fr", bj: "fr", bl: "fr", bn: "en",
  bo: "es", bq: "nl", br: "pt", bs: "en", bw: "en", bz: "en", ca: "en", cd: "fr",
  cf: "fr", cg: "fr", ch: "de", ci: "fr", ck: "en", cl: "es", cm: "fr", cn: "zh",
  co: "es", cp: "fr", cr: "es", cu: "es", cv: "pt", cw: "nl", cx: "en", de: "de",
  dj: "fr", dm: "en", do: "es", ea: "es", ec: "es", es: "es", fj: "en", fk: "en",
  fm: "en", fr: "fr", ga: "fr", gb: "en", gd: "en", gf: "fr", gg: "en", gh: "en",
  gi: "en", gm: "en", gn: "fr", gp: "fr", gq: "es", gs: "en", gt: "es", gu: "en",
  gw: "pt", gy: "en", hn: "es", ic: "es", im: "en", io: "en", it: "it", je: "en",
  jm: "en", jp: "ja", ke: "en", ki: "en", kr: "ko", kn: "en", ky: "en", lc: "en",
  li: "de", lr: "en", mc: "fr", ml: "fr", mp: "en", mq: "fr", ms: "en", mu: "en",
  mw: "en", mx: "es", mz: "pt", na: "en", nc: "fr", ne: "fr", nf: "en", ng: "en",
  ni: "es", nl: "nl", nz: "en", pa: "es", pe: "es", pf: "fr", pl: "pl", pm: "fr",
  pn: "en", pr: "es", pt: "pt", pw: "en", py: "es", re: "fr", ru: "ru", sb: "en",
  sc: "en", sg: "en", sh: "en", sl: "en", sm: "it", sn: "fr", sr: "nl", ss: "en",
  st: "pt", sv: "es", sx: "nl", ta: "en", tc: "en", td: "fr", tf: "fr", tg: "fr",
  tt: "en", ug: "en", um: "en", us: "en", uy: "es", va: "it", vc: "en", ve: "es",
  vg: "en", vi: "en", wf: "fr", yt: "fr", zm: "en", zw: "en", bg: "bg", cz: "cs",
  dk: "da", gr: "el", ee: "et", fi: "fi", hu: "hu", id: "id", lt: "lt", ro: "ro",
  sk: "sk", si: "sl", se: "sv", tr: "tr", ua: "uk",
};

// Type declarations for Deno global (available at runtime in Deno environment)
// @ts-ignore - Deno is a global in Deno runtime
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
  exit(code: number): never;
  serve(options: { port: number }, handler: (req: Request) => Response | Promise<Response>): void;
};

// Get environment variables
// @ts-ignore - Deno.env is available at runtime
const botToken = Deno.env.get("SLACK_BOT_TOKEN");
// @ts-ignore
const signingSecret = Deno.env.get("SLACK_SIGNING_SECRET");
// @ts-ignore
const deeplAuthKey = Deno.env.get("DEEPL_AUTH_KEY");
// @ts-ignore
const port = parseInt(Deno.env.get("PORT") || "10000");

if (!botToken || !signingSecret) {
  console.error("Missing SLACK_BOT_TOKEN or SLACK_SIGNING_SECRET");
  // @ts-ignore
  Deno.exit(1);
}

if (!deeplAuthKey) {
  console.error("Missing DEEPL_AUTH_KEY");
  // @ts-ignore
  Deno.exit(1);
}

// Slack API client helper
async function slackApi(method: string, body: Record<string, unknown>) {
  const response = await fetch(`https://slack.com/api/${method}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${botToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return await response.json();
}

// Handle reaction_added event
async function handleReactionAdded(event: any) {
  try {
    // Log full event structure for debugging
    console.log(`=== Reaction Event Received ===`);
    console.log(`Event structure:`, JSON.stringify({
      reaction: event.reaction,
      item_type: event.item?.type,
      item_channel: event.item?.channel,
      item_ts: event.item?.ts,
      item_file: event.item?.file,
      user: event.user,
    }, null, 2));
    const reaction = event.reaction;
    const channelId = event.item?.channel;
    const messageTs = event.item?.ts;
    const itemType = event.item?.type;

     if (!channelId || !messageTs) {
      console.error(`✗ Missing required event data: channelId=${channelId}, messageTs=${messageTs}`);
      console.error(`Full event:`, JSON.stringify(event, null, 2));
      return;
    }

    console.log(`Reaction added: ${reaction} in channel ${channelId}, message timestamp: ${messageTs}, item type: ${itemType}`);

    // Detect language from reaction
    let lang: string | undefined = undefined;
    if (reaction.startsWith("flag-")) {
      // Extract country code from flag-jp, flag-us, etc.
      const country = reaction.replace(/^flag-/, "");
      lang = allReactionToLang[country];
    } else {
      // Direct reaction like jp, fr, us, etc.
      lang = allReactionToLang[reaction];
    }

    if (!lang) {
      console.log(`No language mapping found for reaction: ${reaction}`);
      return;
    }

    console.log(`✓ Language detected: ${reaction} -> ${lang.toUpperCase()}`);
    
    // Fetch the target message using conversations.history
    // Try multiple approaches to find the message
    
    let targetMessage: any;
    let threadTs: string = messageTs; // Default to message timestamp
    
    // Approach 1: Try conversations.replies with messageTs directly (in case it's a thread parent)
    console.log(`Trying conversations.replies with messageTs directly (${messageTs})...`);
    const directThreadResponse = await slackApi("conversations.replies", {
      channel: channelId,
      ts: messageTs,
      limit: 100,
    });
    
    if (directThreadResponse.error) {
      console.log(`conversations.replies error (expected if not thread parent): ${directThreadResponse.error}`);
    }

    if (!directThreadResponse.error && directThreadResponse.messages) {
      // Check if the first message is our target (it's the thread parent)
      const firstMsg = directThreadResponse.messages[0];
      if (firstMsg && firstMsg.ts === messageTs) {
        targetMessage = firstMsg;
        threadTs = messageTs;
        console.log(`✓ Found message as thread parent via conversations.replies`);
        console.log(`✓ Message text exists: ${!!targetMessage.text}`);
      } else {
        // Search for our message in the thread replies
        const reply = directThreadResponse.messages.find((msg: any) => msg.ts === messageTs);
        if (reply) {
          targetMessage = reply;
          threadTs = reply.thread_ts || messageTs;
          console.log(`✓ Found message in thread replies`);
          console.log(`✓ Message text exists: ${!!targetMessage.text}`);
        }
      }
    }

    // Approach 2: If not found, try conversations.history with time range
    if (!targetMessage) {
      console.log(`Trying conversations.history with time range around ${messageTs}...`);
      const messageTsNum = parseFloat(messageTs);
      const latest = (messageTsNum + 10).toString();
      const oldest = (messageTsNum - 10).toString();
      console.log(`Searching between ${oldest} and ${latest}`);
      
      const messageResponse = await slackApi("conversations.history", {
        channel: channelId,
        latest: latest,
        oldest: oldest,
        inclusive: true,
        limit: 100,
      });

   if (messageResponse.error) {
        console.error(`✗ Failed to fetch message from history: ${messageResponse.error}`);
     // Provide helpful error for MPIM/DM issues
        if (messageResponse.error === "not_in_channel" || messageResponse.error === "channel_not_found") {
          console.error(`✗ Bot is not a member of this conversation. For group DMs, invite the bot using: /invite @YourBotName`);
        }
      } else if (messageResponse.messages && messageResponse.messages.length > 0) {
        console.log(`Found ${messageResponse.messages.length} messages in time range`);
        // Log first few timestamps for debugging
        const sampleTimestamps = messageResponse.messages.slice(0, 5).map((m: any) => m.ts);
        console.log(`Sample timestamps found: ${sampleTimestamps.join(', ')}`);
        console.log(`Looking for: ${messageTs}`);
        
        // Find the message with the exact timestamp
        targetMessage = messageResponse.messages.find((msg: any) => msg.ts === messageTs);
        
        if (targetMessage) {
          // If message has thread_ts, it's a reply - use that as thread parent
          // If no thread_ts, it's a parent message - use its own timestamp
          threadTs = targetMessage.thread_ts || targetMessage.ts;
          console.log(`✓ Found message in history (parent message) with exact timestamp match`);
          console.log(`✓ Message text exists: ${!!targetMessage.text}`);
          console.log(`✓ Thread timestamp: ${threadTs}`);
        } else {
          // Try to find closest match (within 1 second)
          console.log(`No exact match, looking for closest timestamp...`);
          const closest = messageResponse.messages.find((msg: any) => {
            const msgTs = parseFloat(msg.ts);
            const diff = Math.abs(msgTs - messageTsNum);
            if (diff < 1.0) {
              console.log(`Found close match: ${msg.ts} (diff: ${diff}s)`);
              return true;
            }
            return false;
          });
          
          if (closest) {
            targetMessage = closest;
            threadTs = closest.thread_ts || messageTs;
            console.log(`✓ Found message with close timestamp match (${closest.ts})`);
            console.log(`✓ Message text exists: ${!!targetMessage.text}`);
          } else {
            console.log(`No close match found. All timestamps in range:`);
            messageResponse.messages.forEach((msg: any) => {
              const diff = Math.abs(parseFloat(msg.ts) - messageTsNum);
              console.log(`  - ${msg.ts} (diff: ${diff.toFixed(3)}s)`);
            });
          }
        }
      } else {
         console.log(`No messages found in time range`);
      }
    }

    // Approach 3: If still not found, search through recent threads
    if (!targetMessage) {
      console.log(`Searching through recent threads...`);
      const historyResponse = await slackApi("conversations.history", {
        channel: channelId,
        latest: messageTs,
        limit: 200,
      });

      if (!historyResponse.error && historyResponse.messages) {
        const recentParents = historyResponse.messages
          .filter((msg: any) => !msg.thread_ts)
          .slice(0, 50); // Check up to 50 recent threads
    
        for (const parent of recentParents) {
          const parentTs = parent.ts;
          const threadResponse = await slackApi("conversations.replies", {
            channel: channelId,
            ts: parentTs,
            limit: 100,
          });

         if (!threadResponse.error && threadResponse.messages) {
            
            const reply = threadResponse.messages.find((msg: any) => msg.ts === messageTs);
            if (reply) {
              targetMessage = reply;
              threadTs = reply.thread_ts || parentTs;
              console.log(`✓ Found message in thread (parent: ${parentTs})`);
              console.log(`✓ Message text exists: ${!!reply.text}`);
              break;
            }
          }   
        }

        }
    }

    // If still not found, give up
    if (!targetMessage) {
      console.error(`✗ Message with timestamp ${messageTs} not found after all attempts`);
      return;
    }

    // Check if translation already exists
    // Note: conversations.replies requires the thread parent timestamp
    const replies = await slackApi("conversations.replies", {
      channel: channelId,
      ts: threadTs,
    });

     // If there's an error fetching replies, continue anyway (skip duplicate check)
    if (replies.error && replies.error !== "thread_not_found") {
      console.log(`Warning: Could not fetch thread replies for duplicate check: ${replies.error}`);
    }
    
    // Prepare text for translation
    if (!targetMessage.text) {
      console.error("✗ Message has no text content to translate");
      return;
    }

    console.log(`✓ Preparing text for translation (length: ${targetMessage.text.length})`);
    
    const targetText = targetMessage.text
      ?.replace(/<(.*?)>/g, (_: unknown, match: string) => {
        if (match.match(/^[#@].*$/)) {
          const matched = match.match(/^([#@].*)$/);
          if (matched != null) {
            return `<mrkdwn>${matched[1]}</mrkdwn>`;
          }
          return "";
        }
        if (match.match(/^!subteam.*$/)) {
          return "@[subteam mention removed]";
        }
        if (match.match(/^!date.*$/)) {
          const matched = match.match(/^(!date.*)$/);
          if (matched != null) {
            return `<mrkdwn>${matched[1]}</mrkdwn>`;
          }
          return "";
        }
        if (match.match(/^!.*$/)) {
          const matched = match.match(/^!(.*?)(?:\|.*)?$/);
          if (matched != null) {
            return `<ignore>@${matched[1]}</ignore>`;
          }
          return "<ignore>@[special mention]</ignore>";
        }
        if (match.match(/^.*?\|.*$/)) {
          const matched = match.match(/^(.*?)\|(.*)$/);
          if (matched != null) {
            return `<a href="${matched[1]}">${matched[2]}</a>`;
          }
          return "";
        }
        return `<mrkdwn>${match}</mrkdwn>`;
      })
      .replace(/:([a-z0-9_-]+):/g, (_: unknown, match: string) => {
        return `<emoji>${match}</emoji>`;
      }) || "";

    // Call DeepL API
    // Target language is determined by the reaction (e.g., :ru: -> RU, :jp: -> JA)
    // deeplAuthKey is guaranteed to be defined due to check at startup
    const targetLangCode = lang.toUpperCase();
    console.log(`✓ Calling DeepL API for translation to ${targetLangCode}`);
    const apiSubdomain = deeplAuthKey!.endsWith(":fx") ? "api-free" : "api";
    const url = `https://${apiSubdomain}.deepl.com/v2/translate`;
    const body = new URLSearchParams();
    body.append("auth_key", deeplAuthKey!);
    body.append("text", targetText);
    body.append("tag_handling", "xml");
    body.append("ignore_tags", "emoji,mrkdwn,ignore");
    // DeepL API requires uppercase language codes (e.g., "RU", "EN", "JA")
    body.append("target_lang", targetLangCode);

    const deeplResponse = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded;charset=utf-8",
      },
      body,
    });

    if (deeplResponse.status !== 200) {
      const errorText = await deeplResponse.text();
      console.error(`✗ DeepL API error: ${deeplResponse.status}`);
      console.error(`✗ DeepL error response: ${errorText}`);
      return;
    }

    const translationResult = await deeplResponse.json();
    if (
      !translationResult ||
      !translationResult.translations ||
      translationResult.translations.length === 0
    ) {
      console.error("✗ No translation result from DeepL");
      console.error(`✗ Response: ${JSON.stringify(translationResult)}`);
      return;
    }

    
    console.log(`✓ Translation received from DeepL`);

    let translatedText = translationResult.translations[0].text
      .replace(/<emoji>([a-z0-9_-]+)<\/emoji>/g, (_: unknown, match: string) => {
        return `:${match}:`;
      })
      .replace(/<mrkdwn>(.*?)<\/mrkdwn>/g, (_: unknown, match: string) => {
        return `<${match}>`;
      })
      .replace(
        /(<a href="(?:.*?)">(?:.*?)<\/a>)/g,
        (_: unknown, match: string) => {
          const matched = match.match(/<a href="(.*?)">(.*?)<\/a>/);
          if (matched != null) {
            return `<${matched[1]}|${matched[2]}>`;
          }
          return "";
        },
      )
      .replace(/<ignore>(.*?)<\/ignore>/g, (_: unknown, match: string) => {
        return match;
      });

   // Get uppercase language code for prefix
    const targetLang = lang.toUpperCase();
    
    // Prefix translation with language code: (LANG) translated text
    const prefixedTranslation = `(${targetLang}) ${translatedText}`;
    console.log(`✓ Translation prepared: (${targetLang}) ${translatedText.substring(0, 50)}...`);

    // Check if translation for this specific language already exists

    if (replies.messages) {
      for (const msg of replies.messages) {
        // Check if message starts with the same language code prefix
        if (msg.text && msg.text.startsWith(`(${targetLang})`)) {
          console.log(`⚠ Translation for language ${targetLang} already posted, skipping`);
          return;
        }
      }
    }

    // Post translation with language code prefix
   console.log(`✓ Posting translation to Slack thread ${threadTs}`);
    const postResponse = await slackApi("chat.postMessage", {
      channel: channelId,
      text: prefixedTranslation,
      thread_ts: threadTs,
    });

    if (postResponse.error) {
      console.error(`✗ Failed to post translation: ${postResponse.error}`);
      console.error(`✗ Post response:`, JSON.stringify(postResponse, null, 2));
       // Provide helpful error messages for common issues
      if (postResponse.error === "not_in_channel" || postResponse.error === "channel_not_found") {
        console.error(`✗ Bot is not a member of this conversation. For group DMs, invite the bot using: /invite @YourBotName`);
        console.error(`✗ Or use the slash command: /invite-translator`);
      } else if (postResponse.error === "missing_scope") {
        console.error(`✗ Bot is missing required scopes. Add mpim:history, mpim:write, and im:history scopes.`);
      }
      return;
    }

    console.log(`✓✓✓ Translation posted successfully for language: ${targetLang}`);
  } catch (error) {
    console.error("Error handling reaction:", error);
    console.error("Error stack:", error instanceof Error ? error.stack : "No stack trace");
  }
}

// Handle reaction_removed event - delete the corresponding translation
async function handleReactionRemoved(event: any) {
  try {
    const reaction = event.reaction;
    const channelId = event.item?.channel;
    const messageTs = event.item?.ts;

    if (!channelId || !messageTs) {
      console.error(`✗ Missing required event data: channelId=${channelId}, messageTs=${messageTs}`);
      return;
    }

    console.log(`Reaction removed: ${reaction} in channel ${channelId}, message timestamp: ${messageTs}`);

    // Detect language from reaction (same logic as reaction_added)
    let lang: string | undefined = undefined;
    if (reaction.startsWith("flag-")) {
      const country = reaction.replace(/^flag-/, "");
      lang = allReactionToLang[country];
    } else {
      lang = allReactionToLang[reaction];
    }

    if (!lang) {
      console.log(`No language mapping found for reaction: ${reaction}`);
      return;
    }

    const targetLang = lang.toUpperCase();
    console.log(`✓ Language detected: ${reaction} -> ${targetLang}`);

    // Find the message to get the thread timestamp
    // Use the same multi-approach method as handleReactionAdded
    let targetMessage: any = null;
    let threadTs: string = messageTs;
    
    // Approach 1: Try conversations.replies with messageTs directly (in case it's a thread parent)
    console.log(`Trying conversations.replies with messageTs directly (${messageTs})...`);
    const directThreadResponse = await slackApi("conversations.replies", {
      channel: channelId,
      ts: messageTs,
      limit: 100,
    });

    if (directThreadResponse.error) {
      console.log(`conversations.replies error (expected if not thread parent): ${directThreadResponse.error}`);
    }
    if (!directThreadResponse.error && directThreadResponse.messages) {
      const firstMsg = directThreadResponse.messages[0];
      if (firstMsg && firstMsg.ts === messageTs) {
        // messageTs is a thread parent
        targetMessage = firstMsg;
        threadTs = messageTs;
        console.log(`✓ Found message as thread parent via conversations.replies`);
      } else {
        // Search for our message in the thread replies
        const reply = directThreadResponse.messages.find((msg: any) => msg.ts === messageTs);
        if (reply) {
          targetMessage = reply;
          // If found in replies, the parent is the ts we used (messageTs), or use reply.thread_ts if available
          threadTs = reply.thread_ts || messageTs;
          console.log(`✓ Found message in thread replies`);
           console.log(`✓ Thread timestamp: ${threadTs}`);
        }
      }
    }

    // Approach 2: If not found, try conversations.history with time range
    if (!targetMessage) {
      const messageTsNum = parseFloat(messageTs);
      const messageResponse = await slackApi("conversations.history", {
        channel: channelId,
        latest: (messageTsNum + 10).toString(),
        oldest: (messageTsNum - 10).toString(),
        inclusive: true,
        limit: 100,
      });

      if (!messageResponse.error && messageResponse.messages) {
        const foundMsg = messageResponse.messages.find((msg: any) => msg.ts === messageTs);
        if (foundMsg) {
          targetMessage = foundMsg;
          // If message has thread_ts, it's a reply - use that as thread parent
          // If no thread_ts, it's a parent message - use its own timestamp as thread parent
          threadTs = foundMsg.thread_ts || foundMsg.ts;
          console.log(`✓ Found message in history`);
          console.log(`✓ Message is ${foundMsg.thread_ts ? 'a reply' : 'a parent message'}`);
          console.log(`✓ Thread timestamp: ${threadTs}`);
        } else {
          // Try closest match
          const closest = messageResponse.messages.find((msg: any) => {
            const msgTs = parseFloat(msg.ts);
            return Math.abs(msgTs - messageTsNum) < 1.0;
          });
          
          if (closest) {
            targetMessage = closest;
            threadTs = closest.thread_ts || closest.ts;
            console.log(`✓ Found message with close timestamp match`);
            console.log(`✓ Thread timestamp: ${threadTs}`);
          }
        }
      }
    }

    // If still not found, search through recent threads
    if (!targetMessage) {
      const historyResponse = await slackApi("conversations.history", {
        channel: channelId,
        latest: messageTs,
        limit: 200,
      });

      if (!historyResponse.error && historyResponse.messages) {
        const recentParents = historyResponse.messages
          .filter((msg: any) => !msg.thread_ts)
          .slice(0, 50);
        
        for (const parent of recentParents) {
          const parentTs = parent.ts;
          const threadResponse = await slackApi("conversations.replies", {
            channel: channelId,
            ts: parentTs,
            limit: 100,
          });

          if (!threadResponse.error && threadResponse.messages) {
            const reply = threadResponse.messages.find((msg: any) => msg.ts === messageTs);
            if (reply) {
              targetMessage = reply;
              threadTs = reply.thread_ts || parentTs;
              console.log(`✓ Found message in thread (parent: ${parentTs})`);
              break;
            }
          }
        }
      }
    }

    if (!targetMessage) {
      console.error(`✗ Message with timestamp ${messageTs} not found`);
      return;
    }

    // Ensure threadTs is correctly set (it should already be set during message search above)
    // If targetMessage has thread_ts, that's the parent. Otherwise, targetMessage.ts is the parent.
    // Only recalculate if threadTs wasn't already correctly set during the search
    
    if (targetMessage.thread_ts) {
      // Message is a reply, use its thread_ts as the parent
     const calculatedThreadTs = targetMessage.thread_ts;
      if (calculatedThreadTs !== threadTs) {
        console.log(`✓ Updating threadTs: ${threadTs} -> ${calculatedThreadTs} (from message.thread_ts)`);
        threadTs = calculatedThreadTs;
      }
      console.log(`✓ Message is a reply, thread parent: ${threadTs}`);
    } else {
      // Message is a parent, use its own timestamp
     const calculatedThreadTs = targetMessage.ts;
      if (calculatedThreadTs !== threadTs) {
        console.log(`✓ Updating threadTs: ${threadTs} -> ${calculatedThreadTs} (message is parent)`);
        threadTs = calculatedThreadTs;
      }
      console.log(`✓ Message is a parent, thread timestamp: ${threadTs}`);
    }
    // Search for translation in multiple ways
    const translationPrefix = `(${targetLang})`;
    let translationMessage: any = null;

    // Approach 1: Try conversations.replies with the thread parent
    console.log(`Searching for translation (${targetLang}) in thread ${threadTs}...`);
    const replies = await slackApi("conversations.replies", {
      channel: channelId,
      ts: threadTs,
      limit: 100,
    });

    if (!replies.error && replies.messages && replies.messages.length > 0) {
      console.log(`✓ Found ${replies.messages.length} messages in thread, searching...`);
      
     for (const msg of replies.messages) {
        if (msg.text && msg.text.startsWith(translationPrefix)) {
          const isBotMessage = msg.bot_id || msg.subtype === 'bot_message' || !msg.user;
          if (isBotMessage) {
            translationMessage = msg;
            console.log(`✓ Found translation in thread: ${msg.ts}`);
            console.log(`✓ Translation preview: ${msg.text.substring(0, 50)}...`);
            break;
          }
        }
      }
    } else if (replies.error) {
      console.log(`⚠ Could not fetch thread replies: ${replies.error}, trying alternative method...`);
    }

    // Approach 2: If not found, search in recent channel history
    // This works even if conversations.replies fails
    if (!translationMessage) {
      console.log(`Searching in recent channel history for translations...`);
      const historyResponse = await slackApi("conversations.history", {
        channel: channelId,
        latest: messageTs,
        limit: 200,
      });

      if (!historyResponse.error && historyResponse.messages) {
        // Search through all messages to find ones with our translation prefix
        // These would be replies in threads
        for (const msg of historyResponse.messages) {
         // Check if message is in the same thread
          // A message is in the same thread if:
          // 1. It's the thread parent (msg.ts === threadTs)
          // 2. It's a reply in that thread (msg.thread_ts === threadTs)
          // 3. The target message is a reply and this message has the same thread_ts
          const isInSameThread = 
            msg.ts === threadTs || 
            msg.thread_ts === threadTs ||
            (targetMessage.thread_ts && msg.thread_ts === targetMessage.thread_ts);
          
          if (isInSameThread && msg.text && msg.text.startsWith(translationPrefix)) {
            const isBotMessage = msg.bot_id || msg.subtype === 'bot_message' || !msg.user;
            if (isBotMessage) {
              translationMessage = msg;
              console.log(`✓ Found translation in channel history: ${msg.ts}`);
              console.log(`✓ Translation preview: ${msg.text.substring(0, 50)}...`);
              break;
            }
          }
        }
      }
    }

    // Approach 3: If still not found, try searching all recent threads
    if (!translationMessage) {
      console.log(`Searching through all recent threads...`);
      const historyResponse = await slackApi("conversations.history", {
        channel: channelId,
        latest: messageTs,
        limit: 200,
      });
      
    if (!historyResponse.error && historyResponse.messages) {
        const recentParents = historyResponse.messages
          .filter((msg: any) => !msg.thread_ts)
          .slice(0, 50); 

     for (const parent of recentParents) {
          const parentTs = parent.ts;
          const threadResponse = await slackApi("conversations.replies", {
            channel: channelId,
            ts: parentTs,
            limit: 100,
          });
    
      if (!threadResponse.error && threadResponse.messages) {
            // Check if this thread contains our target message
            const containsTarget = threadResponse.messages.some((msg: any) => msg.ts === messageTs);
            
            if (containsTarget) {
              // Update threadTs to the correct parent
              threadTs = parentTs;
              console.log(`✓ Found target message in thread ${parentTs}, searching for translation...`);
              // Search for translation in this thread
              for (const msg of threadResponse.messages) {
                if (msg.text && msg.text.startsWith(translationPrefix)) {
                  const isBotMessage = msg.bot_id || msg.subtype === 'bot_message' || !msg.user;
                  if (isBotMessage) {
                    translationMessage = msg;
                    console.log(`✓ Found translation in thread ${parentTs}: ${msg.ts}`);
                    console.log(`✓ Translation preview: ${msg.text.substring(0, 50)}...`);
                    break;
                  }
                }
              }
              
              if (translationMessage) break;
            }
          }
        }
      }
    }

    if (!translationMessage) {
      console.log(`✗ No translation found for language ${targetLang}`);
      console.log(`Searched thread ${threadTs} and recent channel history`);
      return;
    }

    // Delete the translation message
    console.log(`✓ Deleting translation message ${translationMessage.ts}`);
    const deleteResponse = await slackApi("chat.delete", {
      channel: channelId,
      ts: translationMessage.ts,
    });

    if (deleteResponse.error) {
      console.error(`✗ Failed to delete translation: ${deleteResponse.error}`);
      console.error(`✗ Delete response:`, JSON.stringify(deleteResponse, null, 2));
      
      // Common errors:
      // - "missing_scope": Bot needs chat:write scope
      // - "message_not_found": Message already deleted or doesn't exist
      // - "cant_delete_message": Bot doesn't have permission
      if (deleteResponse.error === "missing_scope") {
        console.error(`✗ Bot needs 'chat:write' scope to delete messages`);
      } else if (deleteResponse.error === "cant_delete_message") {
        console.error(`✗ Bot doesn't have permission to delete this message`);
      }
      return;
    }

    console.log(`✓✓✓ Translation deleted successfully for language: ${targetLang}`);
  } catch (error) {
    console.error("Error handling reaction removal:", error);
    console.error("Error stack:", error instanceof Error ? error.stack : "No stack trace");
  }
}

// Handle slash command to invite bot to group DM
// Note: Slack automatically routes slash commands to the app that created them.
// The botToken used here is already scoped to the specific app, so this will
// always work with the correct bot, even if multiple apps are installed.
async function handleSlashCommand(payload: any): Promise<Response> {
  try {
    const command = payload.command;
    const channelId = payload.channel_id;
    const userId = payload.user_id;
    const responseUrl = payload.response_url;

    console.log(`Slash command received: ${command} in channel ${channelId} by user ${userId}`);

    if (command === "/invite-translator") {
      // Get bot user ID - this uses the botToken which is scoped to this specific app
      const authResponse = await slackApi("auth.test", {});
      if (authResponse.error) {
        console.error(`Failed to get bot info: ${authResponse.error}`);
        return new Response(JSON.stringify({
          response_type: "ephemeral",
          text: "❌ Failed to get bot information. Please try again later."
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      const botUserId = authResponse.user_id;
      const botUserName = authResponse.user;

      // Try to open/join the conversation (works for group DMs)
      // For group DMs, we need to get the user IDs in the conversation
      const channelInfo = await slackApi("conversations.info", {
        channel: channelId,
      });

      if (channelInfo.error) {
        // If we can't get channel info, try to open the conversation with the bot
        const openResponse = await slackApi("conversations.open", {
          users: userId, // Open with the user who ran the command
        });

        if (openResponse.error && openResponse.error !== "already_open") {
          console.error(`Failed to open conversation: ${openResponse.error}`);
          return new Response(JSON.stringify({
            response_type: "ephemeral",
            text: `❌ Could not join this conversation. Please manually invite the bot using:\n\`/invite @${botUserName}\``
          }), {
            status: 200,
            headers: { "Content-Type": "application/json" }
          });
        }
      }

      // Check if bot is already in the channel
      const membersResponse = await slackApi("conversations.members", {
        channel: channelId,
      });

      let isBotInChannel = false;
      if (!membersResponse.error && membersResponse.members) {
        isBotInChannel = membersResponse.members.includes(botUserId);
      }

      if (isBotInChannel) {
        return new Response(JSON.stringify({
          response_type: "ephemeral",
          text: `✅ I'm already in this conversation! You can start using flag reactions (🇯🇵, 🇫🇷, etc.) to translate messages.`
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      // For group DMs, we can't programmatically add the bot
      // But we can provide instructions
      return new Response(JSON.stringify({
        response_type: "ephemeral",
        text: `📝 To add me to this group DM, please type:\n\`/invite @${botUserName}\`\n\nOnce I'm added, you can use flag reactions (🇯🇵, 🇫🇷, 🇪🇸, etc.) to translate messages!`
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Unknown command
    return new Response(JSON.stringify({
      response_type: "ephemeral",
      text: "❌ Unknown command. Available commands: `/invite-translator`"
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Error handling slash command:", error);
    return new Response(JSON.stringify({
      response_type: "ephemeral",
      text: "❌ An error occurred. Please try again later."
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  }
}

// HTTP request handler
async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
// Log all incoming requests for debugging
  console.log(`[${new Date().toISOString()}] ${req.method} ${url.pathname}`);
  
// Health check endpoint for UptimeRobot and other monitoring services
// Always returns simple "OK" response for maximum compatibility
  if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/health")) {
    const userAgent = req.headers.get("user-agent") || "unknown";
    const timestamp = new Date().toISOString();
    
    console.log(`✓ Health check (${url.pathname}) - User-Agent: ${userAgent.substring(0, 50)}`);
    console.log(`✓ Health check - returning OK at ${timestamp}`);
    
   // Always return simple "OK" text for UptimeRobot compatibility
    // UptimeRobot expects HTTP 200 with any response body
    return new Response("OK", { 
      status: 200,
      headers: { 
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0"
      }
    });
  }

   // Slack Slash Commands endpoint
  if (req.method === "POST" && url.pathname === "/slack/commands") {
    console.log("Received POST request to /slack/commands");
    try {
      // Slash commands send URL-encoded form data
      const bodyText = await req.text();
      const payload: any = {};
      const params = new URLSearchParams(bodyText);
      for (const [key, value] of params.entries()) {
        payload[key] = value;
      }

      // Verify request signature (Slash commands use same signature verification)
      const timestamp = req.headers.get("x-slack-request-timestamp");
      const signature = req.headers.get("x-slack-signature");

      if (timestamp && signature) {
        const sigBaseString = `v0:${timestamp}:${bodyText}`;
        const encoder = new TextEncoder();
        const key = await crypto.subtle.importKey(
          "raw",
          encoder.encode(signingSecret),
          { name: "HMAC", hash: "SHA-256" },
          false,
          ["sign"],
        );
        const signatureBytes = await crypto.subtle.sign(
          "HMAC",
          key,
          encoder.encode(sigBaseString),
        );
        const computedSignature = "v0=" + Array.from(new Uint8Array(signatureBytes))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");

        if (signature !== computedSignature) {
          console.error("Invalid Slack slash command signature");
          return new Response("Unauthorized", { status: 401 });
        }
      }

      return await handleSlashCommand(payload);
    } catch (error) {
      console.error("Error processing slash command:", error);
      return new Response("Internal Server Error", { status: 500 });
    }
  }

  // Slack Events API endpoint
  if (req.method === "POST" && url.pathname === "/slack/events") {
     console.log("Received POST request to /slack/events");
    try {
      // Verify request signature
      const body = await req.text();
      console.log("Request body received, length:", body.length);
      const timestamp = req.headers.get("x-slack-request-timestamp");
      const signature = req.headers.get("x-slack-signature");

      if (!timestamp || !signature) {
        console.error("Missing Slack signature headers - timestamp:", timestamp, "signature:", signature ? "present" : "missing");
        console.error("All headers:", Object.fromEntries(req.headers.entries()));
        return new Response("Unauthorized", { status: 401 });
      }

      // Verify timestamp (prevent replay attacks)
      const currentTime = Math.floor(Date.now() / 1000);
      if (Math.abs(currentTime - parseInt(timestamp)) > 300) {
        return new Response("Unauthorized", { status: 401 });
      }

      // Verify signature
      const sigBaseString = `v0:${timestamp}:${body}`;
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(signingSecret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
      );
      const signatureBytes = await crypto.subtle.sign(
        "HMAC",
        key,
        encoder.encode(sigBaseString),
      );
      const computedSignature = "v0=" + Array.from(new Uint8Array(signatureBytes))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      if (signature !== computedSignature) {
        console.error("Invalid Slack request signature");
        console.error("Expected:", computedSignature.substring(0, 20) + "...");
        console.error("Received:", signature.substring(0, 20) + "...");
        return new Response("Unauthorized", { status: 401 });
      }
      console.log("Signature verified successfully");
      
      const payload = JSON.parse(body);

      // Handle URL verification challenge
      if (payload.type === "url_verification") {
        console.log("URL verification challenge received");
        return new Response(payload.challenge, {
          status: 200,
          headers: { "Content-Type": "text/plain" },
        });
      }

      // Handle event callbacks
      if (payload.type === "event_callback") {
        const event = payload.event;
        console.log("Event callback received, event type:", event.type);

        // Respond immediately to Slack (within 3 seconds)
        const response = new Response("OK", { status: 200 });

        // Process event asynchronously
         if (event.type === "reaction_added") {
          console.log("Processing reaction_added event");
          handleReactionAdded(event).catch(console.error);
        } else if (event.type === "reaction_removed") {
          console.log("Processing reaction_removed event");
          handleReactionRemoved(event).catch(console.error);
        } else {
          console.log("Event type not handled, ignoring:", event.type);
        }

        return response;
      }
      
      console.log("Unknown payload type:", payload.type);
      
      return new Response("OK", { status: 200 });
    } catch (error) {
      console.error("Error processing request:", error);
      return new Response("Internal Server Error", { status: 500 });
    }
  }

  console.log(`Unhandled HTTP request (${req.method}) made to ${url.pathname}`);
  return new Response("Not Found", { status: 404 });
}

// Start server using Deno's built-in serve API
console.log(`Starting server on port ${port}...`);
// @ts-ignore - Deno.serve is available at runtime
Deno.serve({ port }, handler);
console.log(`Bolt app is running on port ${port}!`);
