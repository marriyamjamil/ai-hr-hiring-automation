import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";

import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

// Inter for normal text, Plus Jakarta Sans for big headings
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta" });

export const metadata: Metadata = {
  title: "HireAI - Hire faster. Hire fairer.",
  description:
    "HireAI writes job descriptions, scores resumes, screens candidates and books interviews, with a human approving every step.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${jakarta.variable} font-sans antialiased`}>
        {children}
        {/* Pop-up notifications (toasts) appear at the top right */}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
