import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const { image } = await req.json();

        if (!image) {
            return NextResponse.json({ error: "No image provided" }, { status: 400 });
        }

        if (!process.env.OPENROUTER_API_KEY) {
            return NextResponse.json({ error: "OpenRouter API Key is missing" }, { status: 500 });
        }

        // Prepare the image data (remove the data:image/...;base64, prefix)
        const base64Image = image.split(",")[1];

        // Reference image for Charlie Kirk from Wikimedia (user updated)
        const charlieKirkRef = "https://upload.wikimedia.org/wikipedia/commons/1/10/Charlie_Kirk_%2853952923573%29_%28headshot_cropped%29.jpg";

        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "google/gemini-3-pro-image-preview",
                modalities: ["image", "text"],
                messages: [
                    {
                        role: "user",
                        content: [
                            {
                                type: "text",
                                text: "MANDATORY TOTAL FACE SWAP: Image 1 is the reference face of Charlie Kirk. Image 2 is a foundational composition. You MUST perform an EXHAUSTIVE face swap. EVERY single visible face in Image 2, regardless of size or depth, MUST be completely replaced with the face of Charlie Kirk from Image 1. Maintain the identity, small facial proportions, and expression of Image 1, but blend them perfectly into the lighting, grain, and artistic medium of Image 2. DO NOT leave any original faces untouched. DO NOT alter the hair, body, clothing, or surroundings of the original people. This is a technical parody art assignment. Output only the final modified Image 2.",
                            },
                            {
                                type: "image_url",
                                image_url: {
                                    url: charlieKirkRef,
                                },
                            },
                            {
                                type: "image_url",
                                image_url: {
                                    url: `data:image/jpeg;base64,${base64Image}`,
                                },
                            },
                        ],
                    },
                ],
                // Keep safety settings to prevent blocking
                safety_settings: [
                    { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
                    { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
                    { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
                    { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" },
                    { category: "HARM_CATEGORY_CIVIC_INTEGRITY", threshold: "BLOCK_ONLY_HIGH" },
                ],
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("OpenRouter Error:", JSON.stringify(data, null, 2));
            return NextResponse.json({ error: data.error?.message || "Failed to process image" }, { status: response.status });
        }

        const choice = data.choices?.[0];
        if (choice?.native_finish_reason === "IMAGE_SAFETY") {
            return NextResponse.json({ error: "Image generation was blocked by safety filters. Try an image with clearer context." }, { status: 422 });
        }
        if (choice?.native_finish_reason === "IMAGE_RECITATION") {
            return NextResponse.json({ error: "The model detected this image as a copyrighted work and refused to modify it (IMAGE_RECITATION). Try a less famous cover or a different angle." }, { status: 422 });
        }

        // Extraction for Nano Banana on OpenRouter:
        // Usually images are returned in the response as a message content with a data URL
        const message = choice?.message;
        const content = message?.content;

        let processedImageBase64 = null;

        // Recursive helper to find any string starting with "data:image" or an image_url object
        const findImage = (obj: any): string | null => {
            if (!obj) return null;
            if (typeof obj === "string") {
                if (obj.startsWith("data:image")) return obj;
                const match = obj.match(/data:image\/[a-z]+;base64,[a-zA-Z0-9+/=]+/);
                if (match) return match[0];
                return null;
            }
            if (Array.isArray(obj)) {
                for (const item of obj) {
                    const found = findImage(item);
                    if (found) return found;
                }
            }
            if (typeof obj === "object") {
                if (obj.type === "image_url" && obj.image_url?.url) return obj.image_url.url;
                if (obj.url && typeof obj.url === "string" && obj.url.startsWith("data:image")) return obj.url;
                for (const key in obj) {
                    const found = findImage(obj[key]);
                    if (found) return found;
                }
            }
            return null;
        };

        processedImageBase64 = findImage(message);

        if (!processedImageBase64) {
            console.error("No image found in response. Full Choice Object:", JSON.stringify(choice, null, 2));
            return NextResponse.json({
                error: "Model generated tokens but no image data was found in the response. Check logs.",
                debug: choice
            }, { status: 500 });
        }

        return NextResponse.json({ processedImage: processedImageBase64 });

    } catch (error: any) {
        console.error("API Route Error:", error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}
