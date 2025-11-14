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
    const reaction = event.reaction;
    const channelId = event.item.channel;
    const messageTs = event.item.ts;

    console.log(`Reaction added: ${reaction} in channel ${channelId}`);

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

   // Fetch the target message using conversations.history
    // Get recent messages and find the one with matching timestamp
    const messageResponse = await slackApi("conversations.history", {
      channel: channelId,
      latest: messageTs,
      limit: 100,
    });

    if (messageResponse.error) {
      console.error(`Failed to fetch message from history: ${messageResponse.error}`);
      return;
    }

    let targetMessage: any;
    let threadTs: string;

    if (messageResponse.messages && messageResponse.messages.length > 0) {
      // Find the message with the exact timestamp
      targetMessage = messageResponse.messages.find((msg: any) => msg.ts === messageTs);
      
      if (!targetMessage) {
          // Message not found in history - might be a thread reply
        // Try conversations.replies - if message is a thread parent, this will work
        console.log(`Message with timestamp ${messageTs} not found in history, trying thread search...`);
        const threadResponse = await slackApi("conversations.replies", {
          channel: channelId,
          ts: messageTs,
          limit: 100,
        });

        if (threadResponse.error) {
          console.error(`Failed to fetch from thread: ${threadResponse.error}`);
          console.log(`Searched ${messageResponse.messages.length} messages in history`);
          return;
        }

       if (threadResponse.messages && threadResponse.messages.length > 0) {
          // Search for the exact message in thread replies
          targetMessage = threadResponse.messages.find((msg: any) => msg.ts === messageTs);
          
          if (!targetMessage) {
            // Still not found - might be a reply in a different thread
            console.log(`Message not found in thread either. Searched ${threadResponse.messages.length} thread messages`);
            return;
          }
          
          // Found in thread - use thread parent as threadTs
          threadTs = targetMessage.thread_ts || messageTs;
        } else {
          console.log("No messages found in thread");
          return;
        }
      } else {
        // Found in history
        threadTs = targetMessage.thread_ts || messageTs;
      }
    } else {
       // No messages found in history at all - try thread search
      console.log("No messages found in history, trying thread search...");
      const threadResponse = await slackApi("conversations.replies", {
        channel: channelId,
        ts: messageTs,
        limit: 100,
      });

      if (threadResponse.error) {
        console.error(`Failed to fetch from thread: ${threadResponse.error}`);
        return;
      }

   if (threadResponse.messages && threadResponse.messages.length > 0) {
        targetMessage = threadResponse.messages.find((msg: any) => msg.ts === messageTs);
        
        if (!targetMessage) {
          console.log(`Message not found. Searched ${threadResponse.messages.length} thread messages`);
          return;
        }
        
        threadTs = targetMessage.thread_ts || messageTs;
      } else {
        console.log("No messages found");
        return;
      }
    }

    // Check if translation already exists
    const replies = await slackApi("conversations.replies", {
      channel: channelId,
      ts: threadTs,
    });

    // Prepare text for translation
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
    // deeplAuthKey is guaranteed to be defined due to check at startup
    const apiSubdomain = deeplAuthKey!.endsWith(":fx") ? "api-free" : "api";
    const url = `https://${apiSubdomain}.deepl.com/v2/translate`;
    const body = new URLSearchParams();
    body.append("auth_key", deeplAuthKey!);
    body.append("text", targetText);
    body.append("tag_handling", "xml");
    body.append("ignore_tags", "emoji,mrkdwn,ignore");
    body.append("target_lang", lang.toUpperCase());

    const deeplResponse = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded;charset=utf-8",
      },
      body,
    });

    if (deeplResponse.status !== 200) {
      console.error(`DeepL API error: ${deeplResponse.status}`);
      return;
    }

    const translationResult = await deeplResponse.json();
    if (
      !translationResult ||
      !translationResult.translations ||
      translationResult.translations.length === 0
    ) {
      console.error("No translation result");
      return;
    }

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

    // Check if already posted
    if (replies.messages) {
      for (const msg of replies.messages) {
        if (msg.text === translatedText) {
          console.log("Translation already posted, skipping");
          return;
        }
      }
    }

    // Post translation
    await slackApi("chat.postMessage", {
      channel: channelId,
      text: translatedText,
      thread_ts: threadTs,
    });

    console.log(`Translation posted successfully for language: ${lang}`);
  } catch (error) {
    console.error("Error handling reaction:", error);
  }
}

// HTTP request handler
async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
// Log all incoming requests for debugging
  console.log(`[${new Date().toISOString()}] ${req.method} ${url.pathname}`);
  
// Health check
  if (req.method === "GET" && url.pathname === "/") {
    console.log("Health check - returning OK");
    return new Response("OK", { status: 200 });
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
        }
        else {
          console.log("Event type not reaction_added, ignoring:", event.type);
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
