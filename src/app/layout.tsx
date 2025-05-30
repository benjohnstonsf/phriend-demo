import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Phriend - Your Future Self Counselor",
  description: "Talk to an AI counselor and receive a call back from your future self with wisdom and comfort.",
  keywords: "AI counselor, voice therapy, future self, mental health, emotional support",
  authors: [{ name: "Phriend Team" }],
  creator: "Phriend",
  publisher: "Phriend",
  robots: "index, follow",
  openGraph: {
    title: "Phriend - Your Future Self Counselor",
    description: "Experience the magic of receiving wisdom from your future self",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Phriend - Your Future Self Counselor",
    description: "Talk to an AI counselor and receive a call back from your future self",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
