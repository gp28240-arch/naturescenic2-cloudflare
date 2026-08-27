export default {
  async fetch(request, env, ctx) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);

    try {
      if (url.pathname === "/generate-image" && request.method === "POST") {
        const { prompt } = await request.json();
        const aiResponse = await env.AI.run("@cf/bytedance/stable-diffusion-xl-lightning", {
          prompt: prompt
        });

        return new Response(aiResponse, {
          headers: {
            ...corsHeaders,
            "Content-Type": "image/png"
          }
        });
      }

      if (url.pathname === "/upload" && request.method === "POST") {
        const formData = await request.formData();
        const file = formData.get("file");
        const type = formData.get("type");

        if (!file) {
          return new Response(JSON.stringify({ error: "فایلی دریافت نشد" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        const fileName = `${Date.now()}-${file.name}`;
        if (env.MY_BUCKET) {
          await env.MY_BUCKET.put(fileName, file.stream(), {
            httpMetadata: { contentType: file.type }
          });
        }

        return new Response(JSON.stringify({ 
          success: true, 
          url: `${url.origin}/files/${fileName}`,
          name: file.name,
          type: type
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      if (url.pathname === "/list-files" && request.method === "GET") {
        if (env.MY_BUCKET) {
          const objects = await env.MY_BUCKET.list();
          const files = objects.objects.map(obj => ({
            url: `${url.origin}/files/${obj.key}`,
            name: obj.key
          }));
          return new Response(JSON.stringify(files), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
        return new Response(JSON.stringify([]), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      if (url.pathname.startsWith("/files/") && request.method === "GET") {
        const key = url.pathname.replace("/files/", "");
        if (env.MY_BUCKET) {
          const object = await env.MY_BUCKET.get(key);
          if (object) {
            const headers = new Headers();
            object.writeHttpMetadata(headers);
            headers.set("etag", object.httpEtag);
            Object.assign(headers, corsHeaders);
            return new Response(object.body, { headers });
          }
        }
        return new Response("فایل یافت نشد", { status: 404 });
      }

    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    return new Response("مسیر نامعتبر است", { status: 404, headers: corsHeaders });
  }
};
