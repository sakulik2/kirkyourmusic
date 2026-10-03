import { NextResponse } from "next/server";

const coverInstructions = "Create an original, clearly fictional parody image inspired by the cover reference. Use the cover only for broad composition, color mood, pose, and visual style. Do not reproduce exact artwork, logos, typography, lyrics, or other distinctive copyrighted details; redraw the scene as a new work.";
const identityInstructions = "Give the main visible person the appearance of the person in the identity reference, adapted naturally to the cover's medium.";
const defaultBaseUrl = "https://openrouter.ai/api/v1";
// OpenRouter has no bare gpt-image-* models; they are exposed as GPT-5 image variants.
const openRouterModels: Record<string, string> = { "gpt-image-2": "openai/gpt-5.4-image-2" };
// The Responses API needs a mainline model; the image model goes in the image_generation tool.
const responsesMainModel = "gpt-5.4";

const moderationCodes = new Set(["moderation_blocked", "content_policy_violation"]);
// Gemini reports blocked output through finish reasons rather than HTTP errors.
const blockedFinishReason = /SAFETY|PROHIBITED|BLOCKLIST|SPII|RECITATION/;

function buildPrompt(userPrompt: string, hasIdentity: boolean) {
    const instructions = userPrompt || [coverInstructions, hasIdentity ? identityInstructions : "", "Return only the generated image."].filter(Boolean).join(" ");
    const imageNote = hasIdentity ? "Image 1 is the identity reference. Image 2 is the cover reference." : "The attached image is the cover reference.";
    return `${instructions}\n${imageNote}`;
}

function moderationBlocked(detail?: string) {
    return NextResponse.json({ error: detail || "The provider's content moderation blocked this request", code: "moderation_blocked" }, { status: 422 });
}

function upstreamFailure(data: unknown, fallback: string, status: number) {
    const error = (data as { error?: { message?: unknown; code?: unknown } } | null)?.error;
    const message = typeof error?.message === "string" && error.message ? error.message : fallback;
    if (typeof error?.code === "string" && moderationCodes.has(error.code)) return moderationBlocked(message);
    return NextResponse.json({ error: message }, { status });
}

const imageQualities = ["auto", "low", "medium", "high", "xhigh", "max"];
const imageSizes = ["auto", "1024x1024", "1536x1024", "1024x1536"];
const isImage25Model = (model: string) => model.startsWith("gpt-image-2.5-");

function parseDataUrl(value: string) {
    const match = value.match(/^data:(image\/[a-z0-9.+-]+);base64,([a-zA-Z0-9+/=\s]+)$/i);
    return match ? { mimeType: match[1], base64: match[2].replace(/\s/g, "") } : null;
}

const toDataUrl = (image: { mimeType: string; base64: string }) => `data:${image.mimeType};base64,${image.base64}`;

function toImageFile(base64: string, mimeType: string, name: string) {
    const extension = mimeType.split("/")[1].replace(/[^a-z0-9]/gi, "");
    return new File([Buffer.from(base64, "base64")], `${name}.${extension}`, { type: mimeType });
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
        const model = typeof body?.model === "string" && body.model ? body.model : provider === "gemini" ? "gemini-3-pro-image" : "gpt-image-2";
        const configuredBaseUrl = typeof body?.baseUrl === "string" ? body.baseUrl.trim() : "";
        const userPrompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
        // The identity reference is optional and always comes from the user.
        const rawIdentity = typeof body?.identity === "string" ? body.identity : "";
        const identity = rawIdentity ? parseDataUrl(rawIdentity) : null;
        if (rawIdentity && !identity) return NextResponse.json({ error: "Identity reference must be a valid base64 data URL" }, { status: 400 });
        const prompt = buildPrompt(userPrompt, identity !== null);

        if (provider === "gemini") {
            const cover = parseDataUrl(image);
            if (!cover) return NextResponse.json({ error: "Image must be a valid base64 data URL" }, { status: 400 });
            const apiKey = userKey || process.env.GEMINI_API_KEY;
            if (!apiKey) return NextResponse.json({ error: "API key is missing" }, { status: 400 });
            const parts = [{ text: prompt }, ...[identity, cover].filter(item => item !== null).map(item => ({ inlineData: { mimeType: item.mimeType, data: item.base64 } }))];
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
                body: JSON.stringify({ contents: [{ role: "user", parts }], generationConfig: { responseModalities: ["IMAGE", "TEXT"] } }),
            });
            const data = await response.json().catch(() => null);
            if (!response.ok) return upstreamFailure(data, "Gemini image generation failed", response.status);
            if (data?.promptFeedback?.blockReason) return moderationBlocked();
            const candidate = data?.candidates?.[0];
            const part = candidate?.content?.parts?.find((item: { inlineData?: { mimeType?: string; data?: string } }) => item.inlineData?.data);
            if (part?.inlineData?.data) return NextResponse.json({ processedImage: `data:${part.inlineData.mimeType || "image/png"};base64,${part.inlineData.data}` });
            if (typeof candidate?.finishReason === "string" && blockedFinishReason.test(candidate.finishReason)) return moderationBlocked();
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
        if (isOpenRouter && isImage25Model(bareModel)) return NextResponse.json({ error: "GPT Image 2.5 models are not available on OpenRouter; use an OpenAI API Base URL and key" }, { status: 400 });
        const requestedMode = body?.apiMode === "chat" || body?.apiMode === "images" ? body.apiMode : "responses";
        // OpenRouter image models are only reachable through Chat Completions with image modalities.
        const apiMode = isOpenRouter ? "chat" : requestedMode;
        if (apiMode === "chat" && isImage25Model(bareModel)) return NextResponse.json({ error: "GPT Image 2.5 models require the Images or Responses API" }, { status: 400 });

        if (apiMode === "images") {
            const quality = typeof body?.quality === "string" && imageQualities.includes(body.quality) ? body.quality : "auto";
            const size = typeof body?.size === "string" && imageSizes.includes(body.size) ? body.size : "auto";
            if ((quality === "xhigh" || quality === "max") && !isImage25Model(bareModel)) return NextResponse.json({ error: "xhigh and max quality require a GPT Image 2.5 model" }, { status: 400 });
            let response: Response;
            if (body?.textOnly === true) {
                if (!userPrompt) return NextResponse.json({ error: "Text-only generation requires a prompt" }, { status: 400 });
                response = await fetch(`${baseUrl}/images/generations`, {
                    method: "POST",
                    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
                    body: JSON.stringify({ model: bareModel, prompt: userPrompt, n: 1, quality, size }),
                });
            } else {
                // Reference images are only accepted by the edits endpoint, as multipart image[] fields.
                const cover = parseDataUrl(image);
                if (!cover) return NextResponse.json({ error: "Image must be a valid base64 data URL" }, { status: 400 });
                const form = new FormData();
                form.append("model", bareModel);
                form.append("prompt", prompt);
                form.append("n", "1");
                form.append("quality", quality);
                form.append("size", size);
                if (identity) form.append("image[]", toImageFile(identity.base64, identity.mimeType, "identity"));
                form.append("image[]", toImageFile(cover.base64, cover.mimeType, "cover"));
                response = await fetch(`${baseUrl}/images/edits`, { method: "POST", headers: { Authorization: `Bearer ${apiKey}` }, body: form });
            }
            const data = await response.json().catch(() => null);
            if (!response.ok) return upstreamFailure(data, "Image generation failed", response.status);
            const b64 = data?.data?.[0]?.b64_json;
            if (typeof b64 !== "string" || !b64) return NextResponse.json({ error: "Provider returned no image" }, { status: 502 });
            return NextResponse.json({ processedImage: `data:image/png;base64,${b64}` });
        }

        const cover = parseDataUrl(image);
        if (!cover) return NextResponse.json({ error: "Image must be a valid base64 data URL" }, { status: 400 });
        const imageUrls = [identity, cover].filter(item => item !== null).map(toDataUrl);
        const requestBody = apiMode === "responses" ? {
            model: responsesMainModel,
            input: [{ role: "user", content: [
                { type: "input_text", text: prompt },
                ...imageUrls.map(url => ({ type: "input_image", image_url: url })),
            ] }],
            tools: [{ type: "image_generation", model: bareModel }],
            tool_choice: { type: "image_generation" },
        } : {
            model: isOpenRouter ? openRouterModels[bareModel] || (model.includes("/") ? model : `openai/${model}`) : bareModel,
            modalities: ["image", "text"],
            messages: [{ role: "user", content: [
                { type: "text", text: prompt },
                ...imageUrls.map(url => ({ type: "image_url", image_url: { url } })),
            ] }],
        };
        const response = await fetch(`${baseUrl}/${apiMode === "responses" ? "responses" : "chat/completions"}`, {
            method: "POST",
            headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify(requestBody),
        });
        const data = await response.json().catch(() => null);
        if (!response.ok) return upstreamFailure(data, "Image generation failed", response.status);
        const responseResult = apiMode === "responses" ? data?.output?.find((item: { type?: string; result?: string }) => item.type === "image_generation_call")?.result : null;
        const result = responseResult ? `data:image/png;base64,${responseResult}` : extractDataUrl(data?.choices?.[0]);
        if (!result) return NextResponse.json({ error: "Provider returned no image" }, { status: 502 });
        return NextResponse.json({ processedImage: result });
    } catch (error: unknown) {
        console.error("kirkify failed", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
