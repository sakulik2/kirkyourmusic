import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KYM - Kirk Your Music",
  description: "Turn a music cover into an original parody image with OpenAI or Gemini image models.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;900&display=swap" rel="stylesheet" />
      </head>
      <body>
        <div className="container">
          {children}
          <footer>
          &copy; {new Date().getFullYear()} KYM
          </footer>
        </div>
      </body>
    </html>
  );
}
