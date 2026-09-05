import { NextResponse } from "next/server";

const defaultPrompt = `Create an original, clearly fictional parody image inspired by the uploaded cover reference. Use the cover only for broad composition, color mood, pose, and visual style. Do not reproduce exact artwork, logos, typography, lyrics, or other distinctive copyrighted details; redraw the scene as a new work. Use the first image as the identity reference and give visible people a recognizable Charlie Kirk-like appearance adapted naturally to the reference medium. Return only the generated image.`;

function extractDataUrl(value: unknown): string | null {
    if (typeof value === "string") return value.startsWith("data:image/") ? value : null;
    if (!value || typeof value !== "object") return null;
    const record = value as Record<string, unknown>;
    const nested = record.image_url as Record<string, unknown> | undefined;
    if (typeof nested?.url === "string" && nested.url.startsWith("data:image/")) return nested.url;
    if (typeof record.url === "string" && record.url.startsWith("data:image/")) return record.url;
    for (const child of Object.values(record)) {
        const found = extractDataUrl(child);
        if (found) return found;
    }
    return null;
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const image = typeof body?.image === "string" ? body.image : "";
        const provider = body?.provider === "gemini" ? "gemini" : "openai";
        const fallbackKey = provider === "gemini" ? process.env.GEMINI_API_KEY : process.env.OPENROUTER_API_KEY;
        const apiKey = typeof body?.apiKey === "string" && body.apiKey ? body.apiKey : fallbackKey;
        const model = typeof body?.model === "string" && body.model ? body.model : provider === "gemini" ? "gemini-2.5-flash-image-preview" : "google/gemini-2.5-flash-image-preview";
        const prompt = typeof body?.prompt === "string" && body.prompt.trim() ? body.prompt.trim() : defaultPrompt;
        const match = image.match(/^data:(image\/[a-z0-9.+-]+);base64,([a-zA-Z0-9+/=\s]+)$/i);
        if (!match) return NextResponse.json({ error: "Image must be a valid base64 data URL" }, { status: 400 });
        if (!apiKey) return NextResponse.json({ error: "API key is missing" }, { status: 500 });
        const [, mimeType, rawBase64] = match;
        const base64 = rawBase64.replace(/\s/g, "");

        if (provider === "gemini") {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ contents: [{ role: "user", parts: [
                    { text: `${prompt}\nThe attached image is the cover reference. Create and return the edited image.` },
                    { inlineData: { mimeType, data: base64 } },
                ] }], generationConfig: { responseModalities: ["IMAGE", "TEXT"] } }),
            });
            const data = await response.json();
            if (!response.ok) return NextResponse.json({ error: data.error?.message || "Gemini image generation failed" }, { status: response.status });
            const part = data.candidates?.[0]?.content?.parts?.find((item: { inlineData?: { mimeType?: string; data?: string } }) => item.inlineData?.data);
            if (part?.inlineData?.data) return NextResponse.json({ processedImage: `data:${part.inlineData.mimeType || "image/png"};base64,${part.inlineData.data}` });
            return NextResponse.json({ error: "Gemini returned no image" }, { status: 502 });
        }

        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({ model, modalities: ["text", "image"], messages: [{ role: "user", content: [
                { type: "text", text: `${prompt}\nThe first image is the identity reference. The second image is the cover reference.` },
                { type: "image_url", image_url: { url: "https://upload.wikimedia.org/wikipedia/commons/1/10/Charlie_Kirk_%2853952923573%29_%28headshot_cropped%29.jpg" } },
                { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } },
            ] }] }),
        });
        const data = await response.json();
        if (!response.ok) return NextResponse.json({ error: data.error?.message || "OpenRouter image generation failed" }, { status: response.status });
        const result = extractDataUrl(data.choices?.[0]);
        if (!result) return NextResponse.json({ error: "Provider returned no image" }, { status: 502 });
        return NextResponse.json({ processedImage: result });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Internal Server Error";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
