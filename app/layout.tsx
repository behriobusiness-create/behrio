import type { Metadata } from "next";
import { Geist_Mono, Vazirmatn } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

const vazirmatn = Vazirmatn({
  variable: "--font-vazirmatn",
  subsets: ["latin", "arabic"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Behrio | کمپین‌های کریتوری با پرداخت بر اساس بازدید واقعی",
    template: "%s | Behrio",
  },
  description:
    "Behrio پلتفرم پرفورمنس مارکتینگ برای کمپین‌های CPM است — کمپین بسازید، با کریتورها همکاری کنید و بر اساس بازدید تأییدشده بپردازید و تسویه کنید.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fa"
      dir="rtl"
      className={`${vazirmatn.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-bg text-fg">
        {children}
        <SpeedInsights />
      </body>
    </html>
  );
}
