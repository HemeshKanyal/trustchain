import { Inter, Outfit } from "next/font/google"; // ✅ New Fonts
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" });

export const metadata = {
  title: "TrustChain | Secure Pharma Supply Chain",
  description: "Blockchain-based pharmaceutical tracking system",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      {/* ✅ suppress hydration warning to avoid Grammarly / extension issues */}
      <body suppressHydrationWarning={true} className={`${inter.variable} ${outfit.variable} font-sans bg-space-blue-900 text-white antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
