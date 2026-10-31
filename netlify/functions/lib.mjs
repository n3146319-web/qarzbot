import { getStore } from "@netlify/blobs";

export const FREE_LIMIT = 10;

const MONTHS = ["yanvar","fevral","mart","aprel","may","iyun","iyul","avgust","sentyabr","oktyabr","noyabr","dekabr"];

export async function tg(method, payload) {
  const res = await fetch(`https://api.telegram.org/bot${process.env.BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json();
}

const store = () => getStore("qarzbot");

export async function loadUser(id) {
  const d = await store().get(`user-${id}`, { type: "json" });
  return d ?? { premium: false, nextId: 1, debts: [] };
}
export const saveUser = (id, data) => store().setJSON(`user-${id}`, data);
export const listUserKeys = async () => (await store().list({ prefix: "user-" })).blobs.map((b) => b.key);
export const getByKey = (key) => store().get(key, { type: "json" });
export const saveByKey = (key, data) => store().setJSON(key, data);

export const today = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tashkent" });

export const money = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " so'm";

export function prettyDate(iso) {
  const [, m, d] = iso.split("-").map(Number);
  return `${d}-${MONTHS[m - 1]}`;
}

export function parseDate(s) {
  const m = s.match(/^(\d{1,2})[.\-/](\d{1,2})(?:[.\-/](\d{2,4}))?$/);
  if (!m) return null;
  const day = +m[1], month = +m[2];
  const t = today();
  let year = m[3] ? +m[3] : +t.slice(0, 4);
  if (year < 100) year += 2000;
  const pad = (x) => String(x).padStart(2, "0");
  let iso = `${year}-${pad(month)}-${pad(day)}`;
  if (!m[3] && iso < t) iso = `${year + 1}-${pad(month)}-${pad(day)}`;
  const dt = new Date(iso + "T00:00:00Z");
  if (isNaN(dt) || dt.getUTCMonth() + 1 !== month || dt.getUTCDate() !== day) return null;
  return iso;
}

export function parseDebt(text) {
  const parts = text.trim().split(/\s+/);
  if (parts.length < 3) return null;
  const due = parseDate(parts.pop());
  let amountStr = parts.pop().toLowerCase();
  let mult = 1;
  if (/(k|ming)$/.test(amountStr)) { mult = 1000; amountStr = amountStr.replace(/(k|ming)$/, ""); }
  const amount = Math.round(parseFloat(amountStr.replace(",", ".")) * mult);
  const name = parts.join(" ");
  if (!due || !amount || amount <= 0 || !name) return null;
  return { name, amount, due };
}
