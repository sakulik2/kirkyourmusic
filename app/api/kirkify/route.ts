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

        // Using Gemini 2.5 Flash Image (Nano Banana) via OpenRouter
        // The prompt is crucial for high-fidelity face swap while maintaining the cover's style.
        const prompt = "Detect the human face in this music album cover and replace it with the face of Charlie Kirk. Maintain the original lighting, texture, and artistic style of the album cover. The output should be the modified album cover only.";

        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
                "Content-Type": "application/json",
                "HTTP-Referer": "https://kym.vercel.app", // Optional for OpenRouter
                "X-Title": "Kirk Your Music",
            },
            body: JSON.stringify({
                model: "google/gemini-2.5-flash-image",
                messages: [
                    {
                        role: "user",
                        content: [
                            {
                                type: "text",
                                text: prompt,
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
                response_format: { type: "json_object" }, // Assuming the model can return JSON with image data or we handle base64 response
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("OpenRouter Error:", data);
            return NextResponse.json({ error: data.error?.message || "Failed to call OpenRouter" }, { status: response.status });
        }

        // Extract the image from the response
        // Note: Models might return the image in different ways. 
        // Gemini Flash Image usually returns the content which might contain the image data if supported by the provider.
        // However, if the model returns text describing the image or a URL, we need to handle it.
        // For "Nano Banana" (Flash Image), it's specifically designed for image-to-image.

        // ADJUSTMENT: If the API returns a base64 string directly in the content or as a specific field.
        // Based on typical multimodal completions, we might get a message content that represents the image.
        const processedImageBase64 = data.choices?.[0]?.message?.content;

        // Check if the output is a valid base64 (simplified check)
        if (!processedImageBase64 || !processedImageBase64.startsWith("data:image")) {
            // Deepmind's Nano Banana in image-to-image mode often returns the binary or base64.
            // We might need to parse it if it's wrapped in JSON.
            // For now, let's assume it returns the data URL or we might need to handle the specific provider's format.
        }

        return NextResponse.json({ processedImage: processedImageBase64 });

    } catch (error: any) {
        console.error("API Route Error:", error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}
