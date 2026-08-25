// naturescenic2/functions/chat.js

export async function onRequestPost(context) {
    // ایجاد هدرهای استاندارد (شامل CORS برای دسترسی امن)
    const headers = new Headers({
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*", // اجازه دسترسی از هر دامنه (بهتر است بعداً به دامنه خودتان محدود شود)
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
    });

    // مدیریت درخواست‌های OPTIONS (CORS preflight)
    if (context.request.method === "OPTIONS") {
        return new Response(null, {
            status: 204,
            headers,
        });
    }

    try {
        // خواندن متن پیام کاربر از بدنه درخواست
        const body = await context.request.json();
        const userText = body.text || "";

        // بررسی اینکه متن پیام خالی نباشد
        if (!userText.trim()) {
            return new Response(JSON.stringify({ reply: "لطفاً پیامی بنویسید." }), {
                status: 200, // ارسال وضعیت OK
                headers,
            });
        }

        // تعریف شخصیت هوش مصنوعی (System Prompt)
        const systemPrompt = "تو یک دستیار هوشمند فارسی‌زبان و صمیمی برای وب‌سایت naturescenic2 هستی. پاسخ را به زبان فارسی روان و کوتاه بنویس.";
        const fullPrompt = `${systemPrompt}\n\nکاربر: ${userText}`;

        // آدرس API متنی رایگان Pollinations AI
        const apiUrl = `https://text.pollinations.ai/${encodeURIComponent(fullPrompt)}`;

        // ارسال درخواست GET به API هوش مصنوعی به همراه User-Agent
        const aiResponse = await fetch(apiUrl, {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Cloudflare Pages Worker; naturescenic2-ai)'
            }
        });

        let replyText = "";

        // بررسی موفقیت‌آمیز بودن پاسخ API
        if (aiResponse.ok) {
            replyText = await aiResponse.text();
            if (!replyText || replyText.trim() === "") {
                replyText = "پاسخی از سمت سرور هوش مصنوعی دریافت نشد.";
            }
        } else {
            // نمایش خطای دقیق‌تر در صورت امکان
            replyText = `در حال حاضر پاسخگویی متنی با مشکل مواجه شده است. (کد خطا: ${aiResponse.status})`;
        }

        // ارسال پاسخ نهایی به مرورگر کاربر
        return new Response(JSON.stringify({ reply: replyText }), {
            status: 200,
            headers,
        });

    } catch (error) {
        // مدیریت خطاهای غیرمنتظره در سرور
        console.error("Chat function error:", error);
        return new Response(JSON.stringify({
            reply: "خطا در برقراری ارتباط با سرور چت. لطفاً دوباره تلاش کنید."
        }), {
            status: 500, // وضعیت خطای داخلی سرور
            headers,
        });
    }
}