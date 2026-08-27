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
      // ۱. آپلود فایل (ویدیو، صدا، عکس) به Cloudflare R2
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

        const fileName = `${Date.now()}-${file.name}`;
        
        // ذخیره مستقیم در سطل R2
        await env.MY_BUCKET.put(fileName, file.stream(), {
          httpMetadata: { contentType: file.type }
        });

        return new Response(JSON.stringify({ 
          success: true, 
          url: `${url.origin}/file/${fileName}`,
          name: file.name,
          type: type
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // ۲. پخش/دانلود فایل‌های ذخیره شده در R2 (ویدیو و صدا به طور مستقیم پخش می‌شوند)
      if (url.pathname.startsWith("/file/") && request.method === "GET") {
        const key = url.pathname.replace("/file/", "");
        const object = await env.MY_BUCKET.get(key);

        if (object === null) {
          return new Response("فایل یافت نشد", { status: 404 });
        }

        const headers = new Headers();
        object.writeHttpMetadata(headers);
        headers.set("etag", object.httpEtag);
        Object.assign(headers, corsHeaders); // اضافه کردن هدرهای CORS برای پخش چندرسانه‌ای

        return new Response(object.body, {
          headers
        });
      }

      // ۳. لیست تمام فایل‌ها برای گالری چرخشی
      if (url.pathname === "/list-files" && request.method === "GET") {
        const objects = await env.MY_BUCKET.list();
        const files = objects.objects.map(obj => ({
          url: `${url.origin}/file/${obj.key}`,
          name: obj.key,
          type: obj.key.match(/\.(mp4|webm|mkv)$/i) ? 'video' : 
                obj.key.match(/\.(mp3|wav|ogg)$/i) ? 'audio' : 'image'
        }));
        return new Response(JSON.stringify(files), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // ۴. ساخت تصویر با هوش مصنوعی (همان کد قبلی)
      if (url.pathname === "/generate-image" && request.method === "POST") {
        const { prompt } = await request.json();
        const aiResponse = await env.AI.run("@cf/bytedance/stable-diffusion-xl-lightning", {
          prompt: prompt
        });

        return new Response(aiResponse, {
          headers: { ...corsHeaders, "Content-Type": "image/png" }
        });
      }

    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    return new Response("مسیر نامعتبر", { status: 404, headers: corsHeaders });
  }
};
