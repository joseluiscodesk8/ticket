import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "swiper/css";
import "swiper/css/pagination";
import "./globals.scss";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Transcripción de tickets",
  description: "Toma una foto de un ticket y transcribe su texto",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}