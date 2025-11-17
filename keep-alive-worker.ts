// Background worker to keep the web service warm by pinging it every 5 minutes
// This prevents the 50-second cold start delay on Render's free tier

// @ts-ignore - Deno is a global in Deno runtime
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

// Get the web service URL from environment variable
// Render will set this automatically if services are in the same account
// Format: https://your-service-name.onrender.com
const webServiceUrl = Deno.env.get("WEB_SERVICE_URL");

if (!webServiceUrl) {
  console.error("✗ WEB_SERVICE_URL environment variable is not set");
  console.error("Please set WEB_SERVICE_URL to your web service URL (e.g., https://your-app.onrender.com)");
  // @ts-ignore
  Deno.exit(1);
}

console.log(`✓ Keep-alive worker started`);
console.log(`✓ Web service URL: ${webServiceUrl}`);
console.log(`✓ Ping interval: 5 minutes (300 seconds)`);

// Ping the web service
async function pingWebService() {
  const startTime = Date.now();
  try {
    const response = await fetch(webServiceUrl, {
      method: "GET",
      headers: {
        "User-Agent": "Render-KeepAlive-Worker/1.0",
      },
    });

    const responseTime = Date.now() - startTime;
    const status = response.status;
    const statusText = response.statusText;

    if (response.ok) {
      const text = await response.text();
      console.log(
        `✓ [${new Date().toISOString()}] Ping successful - Status: ${status} ${statusText}, Response: "${text.substring(0, 20)}", Time: ${responseTime}ms`
      );
      return true;
    } else {
      console.error(
        `✗ [${new Date().toISOString()}] Ping failed - Status: ${status} ${statusText}, Time: ${responseTime}ms`
      );
      return false;
    }
  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error(
      `✗ [${new Date().toISOString()}] Ping error - ${error instanceof Error ? error.message : String(error)}, Time: ${responseTime}ms`
    );
    return false;
  }
}

// Ping immediately on startup (helps if service is spun down)
console.log(`Initial ping...`);
pingWebService().catch(console.error);

// Then ping every 5 minutes (300,000 milliseconds)
const PING_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

setInterval(() => {
  pingWebService().catch(console.error);
}, PING_INTERVAL_MS);

console.log(`✓ Keep-alive worker is running. Will ping every 5 minutes.`);

