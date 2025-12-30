import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KYM - Kirk Your Music",
  description: "Transform your favorite music covers with Charlie Kirk's face using Nano Banana LLM.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;900&display=swap" rel="stylesheet" />
      </head>
      <body>
        <div className="container">
          <header className="hero">
            <h1>Kirk Your Music</h1>
            <p>Upload a music album cover and let Charlie Kirk take over.</p>
          </header>
          {children}
          <footer>
            &copy; {new Date().getFullYear()} KYM - Powered by Nano Banana (Gemini 2.5 Flash Image)
          </footer>
        </div>
      </body>
    </html>
  );
}
