"use client";

import { useEffect, useRef, useState } from "react";

type Provider = "openai" | "gemini";

export default function Home() {
    const [image, setImage] = useState<string | null>(null);
    const [result, setResult] = useState<string | null>(null);
    const [provider, setProvider] = useState<Provider>("openai");
    const [profile, setProfile] = useState("default");
    const [model, setModel] = useState("openai/gpt-image-2");
    const [apiKey, setApiKey] = useState("");
    const [baseUrl, setBaseUrl] = useState("https://openrouter.ai/api/v1");
    const [apiMode, setApiMode] = useState<"responses" | "chat">("responses");
    const [prompt, setPrompt] = useState("");
    const [quality, setQuality] = useState("auto");
    const [size, setSize] = useState("1024x1024");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const hydrated = useRef(false);

    const loadProfile = (name: string) => {
        const safeName = name.trim() || "default";
        setProfile(safeName);
        localStorage.setItem("kym-profile", safeName);
        const saved = localStorage.getItem(`kym-settings:${safeName}`) || (safeName === "default" ? localStorage.getItem("kym-settings") : null);
        if (!saved) return;
        try { const s = JSON.parse(saved); const p = s.provider === "gemini" ? "gemini" : "openai"; const defaultModel = p === "gemini" ? "gemini-3-pro-image-preview" : "openai/gpt-image-2"; const savedModel = typeof s.model === "string" ? s.model : ""; setProvider(p); setModel(p === "openai" && !savedModel.startsWith("openai/") || p === "gemini" && !savedModel.startsWith("gemini-") ? defaultModel : savedModel || defaultModel); setApiKey(s.apiKey || ""); setBaseUrl(s.baseUrl || "https://openrouter.ai/api/v1"); setApiMode(s.apiMode === "chat" ? "chat" : "responses"); setPrompt(s.prompt || ""); setQuality(s.quality || "auto"); setSize(s.size || "1024x1024"); } catch { /* ignore invalid local settings */ }
    };

    useEffect(() => {
        loadProfile(localStorage.getItem("kym-profile") || "default");
        hydrated.current = true;
    }, []);
    useEffect(() => { if (hydrated.current) localStorage.setItem(`kym-settings:${profile}`, JSON.stringify({ provider, model, apiKey, baseUrl, apiMode, prompt, quality, size })); }, [provider, model, apiKey, baseUrl, apiMode, prompt, quality, size, profile]);

    const onFile = (file?: File) => { if (!file || !file.type.startsWith("image/")) return; const reader = new FileReader(); reader.onload = () => { setImage(String(reader.result)); setResult(null); setError(null); }; reader.readAsDataURL(file); };
    useEffect(() => { const handlePaste = (event: ClipboardEvent) => { const file = Array.from(event.clipboardData?.items || []).find(item => item.type.startsWith("image/"))?.getAsFile(); if (file) { event.preventDefault(); onFile(file); } }; window.addEventListener("paste", handlePaste); return () => window.removeEventListener("paste", handlePaste); }, []);
    const generate = async () => {
        if (!image) return; setBusy(true); setError(null); setResult(null);
        try { const response = await fetch("/api/kirkify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image, provider, model, apiKey, baseUrl, apiMode, prompt, quality, size }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error || "Generation failed"); setResult(data.processedImage); } catch (e: unknown) { setError(e instanceof Error ? e.message : "Generation failed"); } finally { setBusy(false); }
    };
    const reset = () => { setImage(null); setResult(null); setError(null); };

    return <main className="workspace">
        <section className="control-panel">
            <div className="panel-heading"><span className="status-dot" /> <div><strong>Generation Studio</strong><small>Image transformation workspace</small></div></div>
            <label>User profile<div className="profile-row"><input value={profile} onChange={e => setProfile(e.target.value)} /><button className="btn" type="button" onClick={() => loadProfile(profile)}>Load</button></div></label>
            <label>Provider<select value={provider} onChange={e => { const p = e.target.value as Provider; setProvider(p); setModel(p === "gemini" ? "gemini-3-pro-image-preview" : "openai/gpt-image-2"); }}><option value="openai">OpenAI</option><option value="gemini">Gemini</option></select></label>
            <label>Model{provider === "gemini" ? <select value={model} onChange={e => setModel(e.target.value)}><option value="gemini-3-pro-image-preview">Gemini 3 Pro Image</option><option value="gemini-3.1-flash-image-preview">Gemini 3.1 Flash Image</option><option value="gemini-3.1-flash-lite-image-preview">Gemini 3.1 Flash-Lite Image</option></select> : <select value={model} onChange={e => setModel(e.target.value)}><option value="openai/gpt-image-2">GPT Image 2</option><option value="openai/gpt-image-1">GPT Image 1</option></select>}</label>
            <label>API key<input type="password" placeholder="Uses server key when empty" value={apiKey} onChange={e => setApiKey(e.target.value)} /></label>
            {provider === "openai" && <label>API Base URL<input value={baseUrl} onChange={e => setBaseUrl(e.target.value)} placeholder="https://api.example.com/v1" /></label>}
            {provider === "openai" && <label>API<select value={apiMode} onChange={e => setApiMode(e.target.value as "responses" | "chat")}><option value="responses">Responses</option><option value="chat">Chat Completions</option></select></label>}
            {provider === "openai" && <p className="privacy-note">Uses OpenRouter by default and supports compatible GPT Image models.</p>}
            <label>Prompt<textarea rows={7} placeholder="Optional instructions for the image edit" value={prompt} onChange={e => setPrompt(e.target.value)} /></label>
            <p className="privacy-note">Settings stay in this browser. Keys are sent only with your generation request.</p>
        </section>
        <section className="canvas-area">
            <header className="canvas-header"><div><h1>Kirk Your Music</h1><p>Turn a cover into an original parody image.</p></div><span className="provider-badge">{provider === "gemini" ? "Gemini" : "OpenAI"}</span></header>
            <div className="dropzone" onClick={() => inputRef.current?.click()} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); onFile(e.dataTransfer.files[0]); }}>
                <input ref={inputRef} type="file" accept="image/*" hidden onChange={e => onFile(e.target.files?.[0])} />
                {image ? <img src={image} alt="Uploaded cover" /> : <><div className="upload-icon">↑</div><strong>Drop an image here</strong><span>or click to browse, or paste an image with Ctrl+V · PNG, JPG, WEBP</span></>}
            </div>
            <div className="result-box">{result ? <img src={result} alt="Generated parody" /> : busy ? <div className="loading-overlay"><div className="spinner" /><span>Generating with {model}...</span></div> : <span className="empty-state">Your generated image will appear here</span>}</div>
            {error && <p className="error-text">{error}</p>}
            <div className="action-row"><button className="btn" onClick={reset} disabled={!image && !result}>Reset</button><button className="btn btn-primary" onClick={generate} disabled={!image || busy}>{busy ? "Generating..." : "Generate image"}</button></div>
        </section>
    </main>;
}
