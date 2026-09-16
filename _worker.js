export default {
  async fetch(request) {
    // 1. Define your exact GitHub Pages URL (no trailing slash)
    const myWebsite = "https://federation-quartermaster.github.io";
    const requestOrigin = request.headers.get("Origin");

    // 2. Reject the request if it isn't coming from your website
    if (requestOrigin !== myWebsite) {
        return new Response("Unauthorized domain.", { status: 403 });
    }

    const corsHeaders = {
      "Access-Control-Allow-Origin": myWebsite,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    // 3. Handle the preflight request
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const targetUrl = url.searchParams.get("url");

    if (!targetUrl) {
      return new Response("Missing ?url= parameter", { status: 400 });
    }

    const requestInit = {
      method: request.method,
      headers: {
        "Content-Type": request.headers.get("Content-Type") || "application/json"
      }
    };
    
    if (request.method === "POST") {
      requestInit.body = await request.clone().text();
    }

    // 4. Fetch from Roblox
    const response = await fetch(targetUrl, requestInit);
    
    // 5. Send back to your GitHub Pages site
    const newResponse = new Response(response.body, response);
    newResponse.headers.set("Access-Control-Allow-Origin", myWebsite);
    
    return newResponse;
  }
};
