"use client";

import { useEffect, useRef, useState } from "react";

type Provider = "openai" | "gemini";

export default function Home() {
    const [image, setImage] = useState<string | null>(null);
    const [result, setResult] = useState<string | null>(null);
    const [provider, setProvider] = useState<Provider>("openai");
    const [model, setModel] = useState("openai/gpt-image-1");
    const [apiKey, setApiKey] = useState("");
    const [prompt, setPrompt] = useState("");
    const [quality, setQuality] = useState("auto");
    const [size, setSize] = useState("1024x1024");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const saved = localStorage.getItem("kym-settings");
        if (saved) try { const s = JSON.parse(saved); const p = s.provider === "gemini" ? "gemini" : "openai"; const defaultModel = p === "gemini" ? "gemini-2.5-flash-image-preview" : "openai/gpt-image-1"; const savedModel = typeof s.model === "string" ? s.model : ""; setProvider(p); setModel(p === "openai" && !savedModel.startsWith("openai/") ? defaultModel : savedModel || defaultModel); setApiKey(s.apiKey || ""); setPrompt(s.prompt || ""); setQuality(s.quality || "auto"); setSize(s.size || "1024x1024"); } catch { /* ignore invalid local settings */ }
    }, []);
    useEffect(() => { localStorage.setItem("kym-settings", JSON.stringify({ provider, model, apiKey, prompt, quality, size })); }, [provider, model, apiKey, prompt, quality, size]);

    const onFile = (file?: File) => { if (!file || !file.type.startsWith("image/")) return; const reader = new FileReader(); reader.onload = () => { setImage(String(reader.result)); setResult(null); setError(null); }; reader.readAsDataURL(file); };
    const generate = async () => {
        if (!image) return; setBusy(true); setError(null); setResult(null);
        try { const response = await fetch("/api/kirkify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image, provider, model, apiKey, prompt, quality, size }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error || "Generation failed"); setResult(data.processedImage); } catch (e: unknown) { setError(e instanceof Error ? e.message : "Generation failed"); } finally { setBusy(false); }
    };
    const reset = () => { setImage(null); setResult(null); setError(null); };

    return <main className="workspace">
        <section className="control-panel">
            <div className="panel-heading"><span className="status-dot" /> <div><strong>Generation Studio</strong><small>Image transformation workspace</small></div></div>
            <label>Provider<select value={provider} onChange={e => { const p = e.target.value as Provider; setProvider(p); setModel(p === "gemini" ? "gemini-2.5-flash-image-preview" : "openai/gpt-image-1"); }}><option value="openai">OpenAI</option><option value="gemini">Gemini</option></select></label>
            <label>Model<input value={model} onChange={e => setModel(e.target.value)} /></label>
            <label>API key<input type="password" placeholder="Uses server key when empty" value={apiKey} onChange={e => setApiKey(e.target.value)} /></label>
            {provider === "openai" && <p className="privacy-note">Uses OpenRouter by default and supports compatible GPT Image models.</p>}
            <label>Prompt<textarea rows={7} placeholder="Optional instructions for the image edit" value={prompt} onChange={e => setPrompt(e.target.value)} /></label>
            <p className="privacy-note">Settings stay in this browser. Keys are sent only with your generation request.</p>
        </section>
        <section className="canvas-area">
            <header className="canvas-header"><div><h1>Kirk Your Music</h1><p>Turn a cover into an original parody image.</p></div><span className="provider-badge">{provider === "gemini" ? "Gemini" : "OpenAI"}</span></header>
            <div className="dropzone" onClick={() => inputRef.current?.click()} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); onFile(e.dataTransfer.files[0]); }}>
                <input ref={inputRef} type="file" accept="image/*" hidden onChange={e => onFile(e.target.files?.[0])} />
                {image ? <img src={image} alt="Uploaded cover" /> : <><div className="upload-icon">↑</div><strong>Drop an image here</strong><span>or click to browse · PNG, JPG, WEBP</span></>}
            </div>
            <div className="result-box">{result ? <img src={result} alt="Generated parody" /> : busy ? <div className="loading-overlay"><div className="spinner" /><span>Generating with {model}...</span></div> : <span className="empty-state">Your generated image will appear here</span>}</div>
            {error && <p className="error-text">{error}</p>}
            <div className="action-row"><button className="btn" onClick={reset} disabled={!image && !result}>Reset</button><button className="btn btn-primary" onClick={generate} disabled={!image || busy}>{busy ? "Generating..." : "Generate image"}</button></div>
        </section>
    </main>;
}
