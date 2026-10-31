import { tg, listUserKeys, getByKey, saveByKey, today, money, prettyDate } from "./lib.mjs";

export default async () => {
  const t = today();
  for (const key of await listUserKeys()) {
    const chatId = key.replace("user-", "");
    const u = await getByKey(key);
    if (!u) continue;

    const due = u.debts.filter((d) => !d.paid && d.due <= t && d.lastReminded !== t);
    if (!due.length) continue;

    const lines = due.map((d) =>
      d.due === t
        ? `🔔 *${d.name}* ${money(d.amount)} qarzini bugun to'lashi kerak.`
        : `⚠️ *${d.name}* — ${money(d.amount)} (muddati ${prettyDate(d.due)} edi, o'tib ketgan).`
    );
    const res = await tg("sendMessage", {
      chat_id: chatId,
      parse_mode: "Markdown",
      text: `*Eslatma*\n\n${lines.join("\n")}\n\nTo'lagan bo'lsa, 📋 Ro'yxat orqali belgilang.`,
    });
    if (res.ok) {
      due.forEach((d) => (d.lastReminded = t));
      await saveByKey(key, u);
    }
  }
};

export const config = { schedule: "0 4 * * *" };
