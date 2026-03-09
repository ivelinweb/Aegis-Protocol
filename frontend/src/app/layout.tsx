import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "react-hot-toast";

const CHAIN_NAME = process.env.NEXT_PUBLIC_CHAIN_NAME || "Tenderly myEth Mainnet";

export const metadata: Metadata = {
  metadataBase: new URL("https://aegis-protocol-1.vercel.app"),
  title: `Aegis Protocol — AI-Powered DeFi Guardian on ${CHAIN_NAME}`,
  description:
    `Autonomous AI agent that monitors your DeFi positions on ${CHAIN_NAME} 24/7, detects risks in real-time using LLM reasoning + Uniswap V2 DEX verification, and executes protective on-chain transactions.`,
  keywords: ["DeFi", "AI Agent", CHAIN_NAME, "Uniswap", "DeFi Guardian", "Autonomous Agent", "Smart Contract", "Risk Management"],
  authors: [{ name: "Aegis Protocol Team" }],
  openGraph: {
    title: "Aegis Protocol — AI-Powered DeFi Guardian",
    description: `Autonomous AI agent protecting your DeFi positions on ${CHAIN_NAME} 24/7. LLM reasoning + Uniswap V2 DEX verification + on-chain execution.`,
    url: "https://aegis-protocol-1.vercel.app",
    siteName: "Aegis Protocol",
    type: "website",
    locale: "en_US",
    images: [{ url: "/og-image.svg", width: 1200, height: 630, alt: "Aegis Protocol — AI-Powered DeFi Guardian" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Aegis Protocol — AI-Powered DeFi Guardian",
    description: `Autonomous AI agent protecting your DeFi positions on ${CHAIN_NAME} 24/7. LLM reasoning + Uniswap V2 DEX verification.`,
    images: ["/og-image.svg"],
  },
  icons: {
    icon: "/favicon.svg",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <meta name="theme-color" content="#0a0e17" />
      </head>
      <body className="bg-[#0a0e17] text-white antialiased min-h-screen">
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "#1a1f2e",
              color: "#e2e8f0",
              border: "1px solid rgba(0, 224, 255, 0.2)",
            },
          }}
        />
        {children}
      </body>
    </html>
  );
}
