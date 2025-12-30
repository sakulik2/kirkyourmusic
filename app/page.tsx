"use client";

import { useState, useRef } from "react";

export default function Home() {
    const [originalImage, setOriginalImage] = useState<string | null>(null);
    const [processedImage, setProcessedImage] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                setOriginalImage(event.target?.result as string);
                setProcessedImage(null);
                setError(null);
            };
            reader.readAsDataURL(file);
        }
    };

    const kirkify = async () => {
        if (!originalImage) return;

        setIsProcessing(true);
        setError(null);

        try {
            const response = await fetch("/api/kirkify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ image: originalImage }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Failed to process image");
            }

            setProcessedImage(data.processedImage);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <main className="card">
            {!originalImage ? (
                <div
                    className="upload-area"
                    onClick={() => fileInputRef.current?.click()}
                >
                    <div className="upload-icon">🎵</div>
                    <h2>Upload Music Cover</h2>
                    <p>Drag and drop or click to select an image</p>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept="image/*"
                        style={{ display: "none" }}
                    />
                </div>
            ) : (
                <div className="preview-section">
                    <div className="preview-container">
                        <div className="image-box">
                            <span className="label">Original</span>
                            <img src={originalImage} alt="Original music cover" />
                        </div>

                        <div className="image-box">
                            <span className="label">Kirkified</span>
                            {processedImage ? (
                                <img src={processedImage} alt="Kirkified cover" />
                            ) : (
                                <div className="loading-bg">
                                    {isProcessing && (
                                        <div className="loading-overlay">
                                            <div className="spinner"></div>
                                            <p>Kirkifying...</p>
                                        </div>
                                    )}
                                    {!isProcessing && <p style={{ padding: '2rem', textAlign: 'center', opacity: 0.5 }}>Ready to transform</p>}
                                </div>
                            )}
                        </div>
                    </div>

                    {error && <p style={{ color: "#ff4444", marginTop: "1rem", textAlign: "center" }}>{error}</p>}

                    <div style={{ display: "flex", gap: "1rem", justifyContent: "center", marginTop: "2rem" }}>
                        <button
                            className="btn"
                            onClick={() => {
                                setOriginalImage(null);
                                setProcessedImage(null);
                                setError(null);
                            }}
                        >
                            Reset
                        </button>
                        <button
                            className="btn btn-primary"
                            onClick={kirkify}
                            disabled={isProcessing || !!processedImage}
                        >
                            {isProcessing ? "Processing..." : "Kirkify It!"}
                        </button>
                    </div>
                </div>
            )}
        </main>
    );
}
