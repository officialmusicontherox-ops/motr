import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

process.loadEnvFile(".env");
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const SECRET = process.env.STRIPE_SPOTLIGHT_WEBHOOK_SECRET!;
const URL = "http://localhost:3100/api/stripe/webhook";

/** Exactly how stripe-node signs: HMAC-SHA256 over "<t>.<payload>". */
function sign(payload: string, secret = SECRET, t = Math.floor(Date.now() / 1000)) {
  const mac = crypto.createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex");
  return `t=${t},v1=${mac}`;
}

function event(sessionId: string, fanId: string, credits: number, cents: number, paid = "paid") {
  return JSON.stringify({
    id: "evt_test_" + crypto.randomBytes(6).toString("hex"),
    object: "event",
    type: "checkout.session.completed",
    api_version: "2025-10-29.clover",
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: sessionId,
        object: "checkout.session",
        payment_status: paid,
        amount_total: cents,
        client_reference_id: fanId,
        metadata: { fanId, bundle: "three", credits: String(credits) },
      },
    },
  });
}

async function post(body: string, sig: string) {
  const res = await fetch(URL, {
    method: "POST",
    headers: { "content-type": "application/json", "stripe-signature": sig },
    body,
  });
  return { status: res.status, body: await res.text() };
}

async function credits(fanId: string) {
  const f = await prisma.fan.findUnique({
    where: { id: fanId },
    select: { spotlightCredits: true },
  });
  return f?.spotlightCredits ?? -1;
}

const pass = (m: string) => console.log("  PASS  " + m);
const fail = (m: string) => { console.log("  FAIL  " + m); process.exitCode = 1; };

async function main() {
  const fan = await prisma.fan.create({
    data: { username: "wh-test-" + crypto.randomBytes(4).toString("hex") },
  });
  console.log(`  fan ${fan.id}, starting credits ${fan.spotlightCredits}\n`);

  // 1. A real, correctly signed purchase.
  const sid = "cs_test_" + crypto.randomBytes(8).toString("hex");
  const body = event(sid, fan.id, 3, 500);
  let r = await post(body, sign(body));
  r.status === 200 ? pass("signed event accepted (200)") : fail(`signed event -> ${r.status} ${r.body}`);
  let c = await credits(fan.id);
  c === 3 ? pass("balance went 0 -> 3") : fail(`balance is ${c}, expected 3`);

  // 2. The same event again, which is what Stripe does when a reply is slow.
  r = await post(body, sign(body));
  r.status === 200 ? pass("replay accepted (200, so Stripe stops retrying)") : fail(`replay -> ${r.status}`);
  c = await credits(fan.id);
  c === 3 ? pass("replay did NOT double-credit") : fail(`replay took balance to ${c}`);

  // 3. A forged event signed with the wrong secret.
  const forged = event("cs_test_forged", fan.id, 10, 1200);
  r = await post(forged, sign(forged, "whsec_wrong_secret_entirely"));
  r.status === 400 ? pass("bad signature rejected (400)") : fail(`bad signature -> ${r.status}`);
  c = await credits(fan.id);
  c === 3 ? pass("forged event credited nothing") : fail(`forged event took balance to ${c}`);

  // 4. No signature at all.
  r = await post(forged, "");
  r.status === 400 ? pass("missing signature rejected (400)") : fail(`no signature -> ${r.status}`);

  // 5. Completed but not actually paid, which happens with slow payment methods.
  const unpaid = event("cs_test_unpaid", fan.id, 10, 1200, "unpaid");
  r = await post(unpaid, sign(unpaid));
  c = await credits(fan.id);
  r.status === 200 && c === 3
    ? pass("unpaid session acknowledged but credited nothing")
    : fail(`unpaid -> ${r.status}, balance ${c}`);

  // 6. The purchase was recorded once.
  const rows = await prisma.spotlightPurchase.count({ where: { fanId: fan.id } });
  rows === 1 ? pass("exactly one SpotlightPurchase row") : fail(`${rows} purchase rows, expected 1`);

  await prisma.spotlightPurchase.deleteMany({ where: { fanId: fan.id } });
  await prisma.fan.delete({ where: { id: fan.id } });
  console.log("\n  cleaned up");
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
