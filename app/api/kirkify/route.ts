import { NextResponse } from "next/server";

const defaultPrompt = `Create an original, clearly fictional parody image inspired by the uploaded cover reference. Use the cover only for broad composition, color mood, pose, and visual style. Do not reproduce exact artwork, logos, typography, lyrics, or other distinctive copyrighted details; redraw the scene as a new work. Use the first image as the identity reference and give visible people a recognizable Charlie Kirk-like appearance adapted naturally to the reference medium. Return only the generated image.`;

const imageOrderNote = "The first image is the identity reference. The second image is the cover reference.";
const identityImageUrl = "https://upload.wikimedia.org/wikipedia/commons/1/10/Charlie_Kirk_%2853952923573%29_%28headshot_cropped%29.jpg";
const defaultBaseUrl = "https://openrouter.ai/api/v1";
// OpenRouter has no bare gpt-image-* models; they are exposed as GPT-5 image variants.
const openRouterModels: Record<string, string> = { "gpt-image-2": "openai/gpt-5.4-image-2", "gpt-image-1": "openai/gpt-5-image" };
// The Responses API needs a mainline model; the image model goes in the image_generation tool.
const responsesMainModel = "gpt-5.4";

let identityImageCache: { mimeType: string; data: string } | null = null;

async function getIdentityImage() {
    if (identityImageCache) return identityImageCache;
    const response = await fetch(identityImageUrl, { headers: { "User-Agent": "KirkYourMusic/0.1" } });
    if (!response.ok) throw new Error("Failed to load identity reference image");
    const mimeType = response.headers.get("content-type")?.split(";")[0] || "image/jpeg";
    identityImageCache = { mimeType, data: Buffer.from(await response.arrayBuffer()).toString("base64") };
    return identityImageCache;
}

function upstreamError(data: unknown, fallback: string): string {
    const message = (data as { error?: { message?: unknown } } | null)?.error?.message;
    return typeof message === "string" && message ? message : fallback;
}

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
        const body = await req.json().catch(() => null);
        const image = typeof body?.image === "string" ? body.image : "";
        const provider = body?.provider === "gemini" ? "gemini" : "openai";
        const userKey = typeof body?.apiKey === "string" ? body.apiKey.trim() : "";
        const model = typeof body?.model === "string" && body.model ? body.model : provider === "gemini" ? "gemini-3-pro-image-preview" : "gpt-image-2";
        const configuredBaseUrl = typeof body?.baseUrl === "string" ? body.baseUrl.trim() : "";
        const prompt = typeof body?.prompt === "string" && body.prompt.trim() ? body.prompt.trim() : defaultPrompt;
        const match = image.match(/^data:(image\/[a-z0-9.+-]+);base64,([a-zA-Z0-9+/=\s]+)$/i);
        if (!match) return NextResponse.json({ error: "Image must be a valid base64 data URL" }, { status: 400 });
        const [, mimeType, rawBase64] = match;
        const base64 = rawBase64.replace(/\s/g, "");

        if (provider === "gemini") {
            const apiKey = userKey || process.env.GEMINI_API_KEY;
            if (!apiKey) return NextResponse.json({ error: "API key is missing" }, { status: 400 });
            const identity = await getIdentityImage();
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
                body: JSON.stringify({ contents: [{ role: "user", parts: [
                    { text: `${prompt}\n${imageOrderNote} Create and return the edited image.` },
                    { inlineData: identity },
                    { inlineData: { mimeType, data: base64 } },
                ] }], generationConfig: { responseModalities: ["IMAGE", "TEXT"] } }),
            });
            const data = await response.json().catch(() => null);
            if (!response.ok) return NextResponse.json({ error: upstreamError(data, "Gemini image generation failed") }, { status: response.status });
            const part = data?.candidates?.[0]?.content?.parts?.find((item: { inlineData?: { mimeType?: string; data?: string } }) => item.inlineData?.data);
            if (part?.inlineData?.data) return NextResponse.json({ processedImage: `data:${part.inlineData.mimeType || "image/png"};base64,${part.inlineData.data}` });
            return NextResponse.json({ error: "Gemini returned no image" }, { status: 502 });
        }

        let baseUrl = defaultBaseUrl;
        if (configuredBaseUrl) {
            let parsed: URL;
            try {
                parsed = new URL(configuredBaseUrl);
            } catch {
                return NextResponse.json({ error: "Invalid API Base URL" }, { status: 400 });
            }
            if (parsed.protocol !== "https:" && parsed.hostname !== "localhost") return NextResponse.json({ error: "API Base URL must use HTTPS" }, { status: 400 });
            baseUrl = configuredBaseUrl.replace(/\/+$/, "");
        }
        const isOpenRouter = new URL(baseUrl).hostname.toLowerCase() === "openrouter.ai";
        // Never forward the server key to a user-chosen host.
        const apiKey = userKey || (isOpenRouter ? process.env.OPENROUTER_API_KEY : undefined);
        if (!apiKey) return NextResponse.json({ error: isOpenRouter ? "API key is missing" : "A custom API Base URL requires your own API key" }, { status: 400 });

        const bareModel = model.replace(/^openai\//, "");
        // OpenRouter image models are only reachable through Chat Completions with image modalities.
        const apiMode = !isOpenRouter && body?.apiMode !== "chat" ? "responses" : "chat";
        const coverUrl = `data:${mimeType};base64,${base64}`;
        const requestBody = apiMode === "responses" ? {
            model: responsesMainModel,
            input: [{ role: "user", content: [
                { type: "input_text", text: `${prompt}\n${imageOrderNote}` },
                { type: "input_image", image_url: identityImageUrl },
                { type: "input_image", image_url: coverUrl },
            ] }],
            tools: [{ type: "image_generation", model: bareModel }],
            tool_choice: { type: "image_generation" },
        } : {
            model: isOpenRouter ? openRouterModels[bareModel] || (model.includes("/") ? model : `openai/${model}`) : bareModel,
            modalities: ["image", "text"],
            messages: [{ role: "user", content: [
                { type: "text", text: `${prompt}\n${imageOrderNote}` },
                { type: "image_url", image_url: { url: identityImageUrl } },
                { type: "image_url", image_url: { url: coverUrl } },
            ] }],
        };
        const response = await fetch(`${baseUrl}/${apiMode === "responses" ? "responses" : "chat/completions"}`, {
            method: "POST",
            headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify(requestBody),
        });
        const data = await response.json().catch(() => null);
        if (!response.ok) return NextResponse.json({ error: upstreamError(data, "Image generation failed") }, { status: response.status });
        const responseResult = apiMode === "responses" ? data?.output?.find((item: { type?: string; result?: string }) => item.type === "image_generation_call")?.result : null;
        const result = responseResult ? `data:image/png;base64,${responseResult}` : extractDataUrl(data?.choices?.[0]);
        if (!result) return NextResponse.json({ error: "Provider returned no image" }, { status: 502 });
        return NextResponse.json({ processedImage: result });
    } catch (error: unknown) {
        console.error("kirkify failed", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
