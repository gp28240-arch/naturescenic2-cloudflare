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
    const GITHUB_TOKEN = env.GITHUB_TOKEN;
    const GITHUB_USERNAME = "gp28240-arch";
    const GITHUB_REPO = "naturescenic2-cloudflare";

    try {
      // ساخت تصویر با هوش مصنوعی
      if (url.pathname === "/generate-image" && request.method === "POST") {
        const { prompt } = await request.json();
        const aiResponse = await env.AI.run("@cf/bytedance/stable-diffusion-xl-lightning", {
          prompt: prompt
        });

        return new Response(aiResponse, {
          headers: { ...corsHeaders, "Content-Type": "image/png" }
        });
      }

      // آپلود عکس، ویدیو و صدا
      if (url.pathname === "/upload" && request.method === "POST") {
        const formData = await request.formData();
        const file = formData.get("file");
        const type = formData.get("type") || "file";

        if (!file) {
          return new Response(JSON.stringify({ error: "فایلی دریافت نشد" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        const arrayBuffer = await file.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64Content = btoa(binary);

        const fileName = `uploads/${Date.now()}-${file.name}`;
        const ghUrl = `https://api.github.com/repos/${GITHUB_USERNAME}/${GITHUB_REPO}/contents/${fileName}`;

        const ghResponse = await fetch(ghUrl, {
          method: "PUT",
          headers: {
            "Authorization": `Bearer ${GITHUB_TOKEN}`,
            "User-Agent": "Cloudflare-Worker",
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            message: `Upload ${file.name}`,
            content: base64Content
          })
        });

        if (ghResponse.ok) {
          const ghData = await ghResponse.json();
          return new Response(JSON.stringify({ 
            success: true, 
            url: ghData.content.download_url,
            name: file.name,
            type: type
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        } else {
          const errData = await ghResponse.json();
          return new Response(JSON.stringify({ error: "خطا در آپلود", details: errData }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
      }

      // دریافت لیست فایل‌های آپلود شده
      if (url.pathname === "/list-files" && request.method === "GET") {
        const ghUrl = `https://api.github.com/repos/${GITHUB_USERNAME}/${GITHUB_REPO}/contents/uploads`;
        const ghResponse = await fetch(ghUrl, {
          headers: {
            "Authorization": `Bearer ${GITHUB_TOKEN}`,
            "User-Agent": "Cloudflare-Worker"
          }
        });

        if (ghResponse.ok) {
          const items = await ghResponse.json();
          const files = items.map(item => ({
            url: item.download_url,
            name: item.name.replace(/^\d+-/, '')
          }));
          return new Response(JSON.stringify(files), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
        return new Response(JSON.stringify([]), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
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
