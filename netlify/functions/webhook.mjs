import { tg, loadUser, saveUser, parseDebt, money, prettyDate, today, FREE_LIMIT } from "./lib.mjs";

const MENU = {
  keyboard: [[{ text: "➕ Qarz kiritish" }, { text: "📋 Ro'yxat" }]],
  resize_keyboard: true,
};

const HELP =
  "👋 *QarzBot* — do'kon daftaringiz endi Telegramda.\n\n" +
  "➕ *Qarz kiritish* — shunchaki bitta qator yozing:\n" +
  "`Karim 50000 15.09`\n" +
  "(ism, summa, qaytarish sanasi; `50k` ham bo'ladi)\n\n" +
  "📋 *Ro'yxat* — kim sizga qarzdor.\n" +
  "Muddat kuni bot o'zi eslatma yuboradi (soat 09:00).\n\n" +
  `Bepul tarif: ${FREE_LIMIT} tagacha faol mijoz.`;

const send = (chat_id, text, extra = {}) =>
  tg("sendMessage", { chat_id, text, parse_mode: "Markdown", ...extra });

const activeNames = (u) => new Set(u.debts.filter((d) => !d.paid).map((d) => d.name.toLowerCase()));

async function showList(chatId, u) {
  const open = u.debts.filter((d) => !d.paid).sort((a, b) => a.due.localeCompare(b.due));
  if (!open.length) return send(chatId, "Hozircha qarzdorlar yo'q 🎉", { reply_markup: MENU });

  const t = today();
  let total = 0;
  const lines = open.map((d, i) => {
    total += d.amount;
    const late = d.due < t ? " ⚠️ muddati o'tgan" : d.due === t ? " 🔔 bugun" : "";
    return `${i + 1}. *${d.name}* — ${money(d.amount)} (${prettyDate(d.due)})${late}`;
  });
  const buttons = open.map((d, i) => [
    { text: `✅ ${i + 1}. ${d.name} to'ladi`, callback_data: `paid:${d.id}` },
  ]);
  return send(chatId, `📋 *Qarzdorlar*\n\n${lines.join("\n")}\n\n💰 Jami: *${money(total)}*`, {
    reply_markup: { inline_keyboard: buttons },
  });
}

async function onMessage(m) {
  if (!m?.text) return;
  const chatId = m.chat.id;
  const text = m.text.trim();

  if (text === "/start" || text === "/help") return send(chatId, HELP, { reply_markup: MENU });

  const u = await loadUser(chatId);

  if (text === "📋 Ro'yxat" || text === "/royxat") return showList(chatId, u);

  if (text === "➕ Qarz kiritish" || text === "/qarz")
    return send(chatId, "Bitta qatorda yozing:\n`Ism summa sana`\nMasalan: `Karim 50000 15.09`");

  const debt = parseDebt(text);
  if (!debt)
    return send(chatId, "Tushunmadim 🤔 Mana bunday yozing:\n`Karim 50000 15.09`", { reply_markup: MENU });

  const names = activeNames(u);
  if (!u.premium && !names.has(debt.name.toLowerCase()) && names.size >= FREE_LIMIT)
    return send(
      chatId,
      `Bepul tarifda ${FREE_LIMIT} tagacha faol mijoz mumkin. Cheksiz uchun Premium (15 000 so'm/oy) kerak.`
    );

  u.debts.push({ id: u.nextId++, ...debt, paid: false, lastReminded: null });
  await saveUser(chatId, u);
  return send(
    chatId,
    `✅ Saqlandi: *${debt.name}* — ${money(debt.amount)}.\n${prettyDate(debt.due)} kuni eslataman.`,
    { reply_markup: MENU }
  );
}

async function onCallback(q) {
  const chatId = q.message.chat.id;
  const [action, idStr] = q.data.split(":");
  if (action === "paid") {
    const u = await loadUser(chatId);
    const d = u.debts.find((x) => x.id === +idStr);
    if (d && !d.paid) {
      d.paid = true;
      await saveUser(chatId, u);
      await tg("answerCallbackQuery", { callback_query_id: q.id, text: `${d.name} to'ladi ✅` });
    } else {
      await tg("answerCallbackQuery", { callback_query_id: q.id });
    }
    await tg("deleteMessage", { chat_id: chatId, message_id: q.message.message_id });
    return showList(chatId, u);
  }
  return tg("answerCallbackQuery", { callback_query_id: q.id });
}

export default async (req) => {
  if (req.method !== "POST") return new Response("QarzBot ok");
  if (req.headers.get("x-telegram-bot-api-secret-token") !== process.env.WEBHOOK_SECRET)
    return new Response("forbidden", { status: 403 });

  try {
    const update = await req.json();
    if (update.callback_query) await onCallback(update.callback_query);
    else await onMessage(update.message);
  } catch (e) {
    console.error(e);
  }
  return new Response("ok");
};

export const config = { path: "/api/webhook" };
