import { NextResponse } from "next/server";

export async function GET() {
  try {
    const res = await fetch("https://examweb.ggsipu.ac.in/web/CaptchaServlet", {
      headers: { "User-Agent": "Mozilla/5.0" },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Upstream ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const b64 = `data:image/png;base64,${buf.toString("base64")}`;
    return NextResponse.json({ displayImage: b64, ocrImage: b64 });
  } catch (err) {
    console.error("Captcha fetch error:", err);
    return NextResponse.json({ error: "Failed to fetch captcha" }, { status: 502 });
  }
}
