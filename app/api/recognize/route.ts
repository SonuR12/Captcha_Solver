import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Models in priority order — fastest + most accurate first
const MODELS = [
  "meta-llama/llama-4-scout-17b-16e-instruct",
  "meta-llama/llama-4-maverick-17b-128e-instruct",
];

const PROMPT = `You are a CAPTCHA solver. Look at this CAPTCHA image carefully.
Rules:
- Return ONLY the exact alphanumeric characters shown (letters and digits)
- Preserve exact case (uppercase/lowercase as shown)
- No spaces, no punctuation, no explanation
- If unsure between similar chars (0/O, 1/l/I), pick the most visually likely one
Output: just the characters, nothing else.`;

export async function POST(req: NextRequest) {
  const { ocrImage, imageUrl } = await req.json();
  if (!ocrImage && !imageUrl) {
    return NextResponse.json({ error: "No image provided" }, { status: 400 });
  }
  if (!process.env.GROQ_API_KEY || process.env.GROQ_API_KEY === "your_groq_api_key_here") {
    return NextResponse.json({ error: "GROQ_API_KEY not set in .env.local" }, { status: 500 });
  }

  const base64 = ocrImage
    ? ocrImage.replace(/^data:image\/\w+;base64,/, "")
    : null;
  const mimeType = ocrImage?.match(/^data:(image\/\w+);base64,/)?.[1] ?? "image/png";

  const imageContent = imageUrl
    ? { type: "image_url" as const, image_url: { url: imageUrl } }
    : { type: "image_url" as const, image_url: { url: `data:${mimeType};base64,${base64}` } };

  let lastErr: unknown;
  for (const model of MODELS) {
    try {
      const response = await groq.chat.completions.create({
        model,
        messages: [
          {
            role: "user",
            content: [
              imageContent,
              { type: "text", text: PROMPT },
            ],
          },
        ],
        max_tokens: 20,
        temperature: 0.0, // deterministic = more accurate
      });

      const raw = response.choices[0]?.message?.content?.trim() ?? "";
      const text = raw.replace(/[^A-Za-z0-9]/g, "");
      return NextResponse.json({ text, confidence: 99 });
    } catch (e: unknown) {
      console.error(`Groq [${model}] error:`, JSON.stringify(e));
      lastErr = e;
      const status = (e as { status?: number })?.status;
      if (status === 429 || status === 503 || status === 400) continue;
      return NextResponse.json({ error: "Groq OCR failed" }, { status: 500 });
    }
  }

  console.error("Groq error:", lastErr);
  const s = (lastErr as { status?: number })?.status;
  return NextResponse.json(
    { error: s === 429 ? "Groq quota exceeded — wait a moment and retry" : "Groq OCR failed" },
    { status: 500 }
  );
}
