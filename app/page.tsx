"use client";

import { useEffect, useRef, useState } from "react";

type Provider = "openai" | "gemini";
type ApiMode = "images" | "responses" | "chat";

const openaiModels = [
    { id: "gpt-image-2.5-sunburst", label: "GPT Image 2.5 Sunburst" },
    { id: "gpt-image-2.5-flare", label: "GPT Image 2.5 Flare" },
    { id: "gpt-image-2", label: "GPT Image 2" },
];
const geminiModels = [
    { id: "gemini-3-pro-image", label: "Gemini 3 Pro Image" },
    { id: "gemini-3.1-flash-image", label: "Gemini 3.1 Flash Image" },
    { id: "gemini-3.1-flash-lite-image", label: "Gemini 3.1 Flash-Lite Image" },
];
// Retired preview IDs map to their stable replacements; other unknown IDs fall back to the default.
const renamedModels: Record<string, string> = {
    "gemini-3-pro-image-preview": "gemini-3-pro-image",
    "gemini-3.1-flash-image-preview": "gemini-3.1-flash-image",
    "gemini-3.1-flash-lite-image-preview": "gemini-3.1-flash-lite-image",
};
const isImage25Model = (id: string) => id.startsWith("gpt-image-2.5-");

export default function Home() {
    const [image, setImage] = useState<string | null>(null);
    const [result, setResult] = useState<string | null>(null);
    const [provider, setProvider] = useState<Provider>("openai");
    const [profile, setProfile] = useState("default");
    const [model, setModel] = useState("gpt-image-2");
    const [apiKey, setApiKey] = useState("");
    const [baseUrl, setBaseUrl] = useState("https://openrouter.ai/api/v1");
    const [apiMode, setApiMode] = useState<ApiMode>("images");
    const [prompt, setPrompt] = useState("");
    const [quality, setQuality] = useState("auto");
    const [size, setSize] = useState("auto");
    const [textOnly, setTextOnly] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    // Profile whose settings are currently loaded; settings are saved only under it.
    const [loadedProfile, setLoadedProfile] = useState<string | null>(null);
    const isOpenRouter = /^https:\/\/openrouter\.ai(\/|$)/i.test(baseUrl.trim());
    // GPT Image 2.5 is not on OpenRouter, and it does not support Chat Completions.
    const modelOptions = provider === "gemini" ? geminiModels : isOpenRouter ? openaiModels.filter(m => !isImage25Model(m.id)) : openaiModels;
    const activeModel = modelOptions.some(m => m.id === model) ? model : modelOptions[0].id;
    const activeApiMode: ApiMode = isOpenRouter ? "chat" : apiMode === "chat" && isImage25Model(activeModel) ? "images" : apiMode;
    const usesImagesApi = provider === "openai" && activeApiMode === "images";
    const isTextOnly = usesImagesApi && textOnly;
    const qualityOptions = isImage25Model(activeModel) ? ["auto", "low", "medium", "high", "xhigh", "max"] : ["auto", "low", "medium", "high"];
    const activeQuality = qualityOptions.includes(quality) ? quality : "auto";
    const canGenerate = !busy && (isTextOnly ? prompt.trim() !== "" : image !== null);

    const loadProfile = (name: string) => {
        const safeName = name.trim() || "default";
        setProfile(safeName);
        localStorage.setItem("kym-profile", safeName);
        setLoadedProfile(safeName);
        const saved = localStorage.getItem(`kym-settings:${safeName}`) || (safeName === "default" ? localStorage.getItem("kym-settings") : null);
        if (!saved) return;
        try {
            const s = JSON.parse(saved);
            const p: Provider = s.provider === "gemini" ? "gemini" : "openai";
            const options = p === "gemini" ? geminiModels : openaiModels;
            const rawModel = typeof s.model === "string" ? s.model.replace(/^openai\//, "") : "";
            const savedModel = renamedModels[rawModel] || rawModel;
            setProvider(p);
            setModel(options.some(m => m.id === savedModel) ? savedModel : options[0].id);
            setApiKey(s.apiKey || "");
            setBaseUrl(s.baseUrl || "https://openrouter.ai/api/v1");
            setApiMode(s.apiMode === "chat" || s.apiMode === "responses" ? s.apiMode : "images");
            setPrompt(s.prompt || "");
            setQuality(typeof s.quality === "string" ? s.quality : "auto");
            setSize(typeof s.size === "string" ? s.size : "auto");
            setTextOnly(s.textOnly === true);
        } catch { /* ignore invalid local settings */ }
    };

    useEffect(() => {
        loadProfile(localStorage.getItem("kym-profile") || "default");
    }, []);
    useEffect(() => { if (loadedProfile) localStorage.setItem(`kym-settings:${loadedProfile}`, JSON.stringify({ provider, model, apiKey, baseUrl, apiMode, prompt, quality, size, textOnly })); }, [provider, model, apiKey, baseUrl, apiMode, prompt, quality, size, textOnly, loadedProfile]);

    const onFile = (file?: File) => { if (!file || !file.type.startsWith("image/")) return; const reader = new FileReader(); reader.onload = () => { setImage(String(reader.result)); setResult(null); setError(null); }; reader.readAsDataURL(file); };
    useEffect(() => { const handlePaste = (event: ClipboardEvent) => { const file = Array.from(event.clipboardData?.items || []).find(item => item.type.startsWith("image/"))?.getAsFile(); if (file) { event.preventDefault(); onFile(file); } }; window.addEventListener("paste", handlePaste); return () => window.removeEventListener("paste", handlePaste); }, []);
    const generate = async () => {
        if (!canGenerate) return; setBusy(true); setError(null); setResult(null);
        try { const response = await fetch("/api/kirkify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image: isTextOnly ? undefined : image, provider, model: activeModel, apiKey, baseUrl, apiMode: activeApiMode, prompt, quality: activeQuality, size, textOnly: isTextOnly }) }); const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error || (response.status === 413 ? "Image is too large to upload" : `Generation failed (${response.status})`)); setResult(data.processedImage); } catch (e: unknown) { setError(e instanceof Error ? e.message : "Generation failed"); } finally { setBusy(false); }
    };
    const reset = () => { setImage(null); setResult(null); setError(null); };

    return <main className="workspace">
        <section className="control-panel">
            <div className="panel-heading"><span className="status-dot" /> <div><strong>Generation Studio</strong><small>Image transformation workspace</small></div></div>
            <label>User profile<div className="profile-row"><input value={profile} onChange={e => setProfile(e.target.value)} /><button className="btn" type="button" onClick={() => loadProfile(profile)}>Load</button></div></label>
            <label>Provider<select value={provider} onChange={e => { const p = e.target.value as Provider; setProvider(p); setModel((p === "gemini" ? geminiModels : openaiModels)[0].id); }}><option value="openai">OpenAI</option><option value="gemini">Gemini</option></select></label>
            <label>Model<select value={activeModel} onChange={e => setModel(e.target.value)}>{modelOptions.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}</select></label>
            <label>API key<input type="password" placeholder="Uses server key when empty" value={apiKey} onChange={e => setApiKey(e.target.value)} /></label>
            {provider === "openai" && <label>API Base URL<input value={baseUrl} onChange={e => setBaseUrl(e.target.value)} placeholder="https://api.openai.com/v1" /></label>}
            {provider === "openai" && !isOpenRouter && <label>API<select value={activeApiMode} onChange={e => setApiMode(e.target.value as ApiMode)}><option value="images">Images</option><option value="responses">Responses</option>{!isImage25Model(activeModel) && <option value="chat">Chat Completions</option>}</select></label>}
            {usesImagesApi && <label>Quality<select value={activeQuality} onChange={e => setQuality(e.target.value)}>{qualityOptions.map(q => <option key={q} value={q}>{q}</option>)}</select></label>}
            {usesImagesApi && <label>Size<select value={size} onChange={e => setSize(e.target.value)}><option value="auto">auto</option><option value="1024x1024">1024x1024</option><option value="1536x1024">1536x1024</option><option value="1024x1536">1024x1536</option></select></label>}
            {usesImagesApi && <label className="checkbox-row"><input type="checkbox" checked={textOnly} onChange={e => setTextOnly(e.target.checked)} />Text only (ignore uploaded cover)</label>}
            {provider === "openai" && <p className="privacy-note">{isOpenRouter ? "OpenRouter offers GPT Image 2 only. Set an OpenAI API Base URL and key to use GPT Image 2.5." : "A custom API Base URL requires your own API key."}</p>}
            <label>Prompt<textarea rows={7} placeholder={isTextOnly ? "Describe the image to generate (required)" : "Optional instructions for the image edit"} value={prompt} onChange={e => setPrompt(e.target.value)} /></label>
            <p className="privacy-note">Settings stay in this browser. Keys are sent only with your generation request.</p>
        </section>
        <section className="canvas-area">
            <header className="canvas-header"><div><h1>Kirk Your Music</h1><p>Turn a cover into an original parody image.</p></div><span className="provider-badge">{provider === "gemini" ? "Gemini" : "OpenAI"}</span></header>
            <div className="dropzone" onClick={() => inputRef.current?.click()} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); onFile(e.dataTransfer.files[0]); }}>
                <input ref={inputRef} type="file" accept="image/*" hidden onChange={e => onFile(e.target.files?.[0])} />
                {image ? <img src={image} alt="Uploaded cover" /> : <><div className="upload-icon">↑</div><strong>Drop an image here</strong><span>or click to browse, or paste an image with Ctrl+V · PNG, JPG, WEBP</span></>}
            </div>
            <div className="result-box">{result ? <img src={result} alt="Generated parody" /> : busy ? <div className="loading-overlay"><div className="spinner" /><span>Generating with {activeModel}...</span></div> : <span className="empty-state">Your generated image will appear here</span>}</div>
            {error && <p className="error-text">{error}</p>}
            <div className="action-row"><button className="btn" onClick={reset} disabled={!image && !result}>Reset</button><button className="btn btn-primary" onClick={generate} disabled={!canGenerate}>{busy ? "Generating..." : "Generate image"}</button></div>
        </section>
    </main>;
}
