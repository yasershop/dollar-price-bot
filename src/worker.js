export default {
  async fetch(request, env, ctx) {
    const pricesUrl = env.FETCH_API_URL;
    const botToken = env.BOT_TOKEN;
    const chatId = env.TARGET_CHANNEL_ID;
    const kv = env.PRICE_KV;

    const isDailySummary = new URL(request.url).pathname === "/summary";

    const response = await fetch(pricesUrl);
    const messages = await response.json();

    let dollar = null;
    let gold = null;

    for (const msg of messages) {
      const text = msg.text;

      const dollarMatch = text.match(/دلار\s*[:=]?\s*([\d,]+)/i);
      const goldMatch = text.match(/(طلا|مثقال)\s*[:=]?\s*([\d,]+)/i);

      if (dollarMatch) dollar = parseInt(dollarMatch[1].replace(/,/g, ''));
      if (goldMatch) gold = parseInt(goldMatch[2].replace(/,/g, ''));
    }

    if (dollar) {
      const prev = parseInt(await kv.get("dollar")) || dollar;
      await kv.put("dollar", dollar);
      const min = Math.min(dollar, parseInt(await kv.get("min_dollar") || dollar));
      const max = Math.max(dollar, parseInt(await kv.get("max_dollar") || dollar));
      await kv.put("min_dollar", min);
      await kv.put("max_dollar", max);

      if (dollar !== prev) {
        const trend = dollar > prev ? "📈" : "📉";
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: `قیمت دلار: ${dollar.toLocaleString()} تومان ${trend}`,
          }),
        });
      }
    }

    if (isDailySummary) {
      const min = await kv.get("min_dollar");
      const max = await kv.get("max_dollar");

      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: `📊 گزارش روز:\nحداقل دلار: ${parseInt(min).toLocaleString()} تومان\nحداکثر دلار: ${parseInt(max).toLocaleString()} تومان`,
        }),
      });

      await kv.delete("min_dollar");
      await kv.delete("max_dollar");
    }

    return new Response("✅ Done");
  },
};
