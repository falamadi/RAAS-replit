import type { Metadata } from "next";
import { Inter } from "next/font/google";
// import "./globals.css"; // Temporarily commented out
import { Providers } from "@/components/providers";
import { Toaster } from "@/components/ui/toaster";
import { ErrorBoundary } from "@/components/error-boundary";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "RaaS - Recruitment as a Service",
  description: "Intelligent recruitment platform connecting job seekers, recruiters, and companies",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className} style={{margin: 0, padding: 0, fontFamily: 'system-ui, sans-serif'}}>
        <ErrorBoundary>
          <Providers>
            {children}
            <Toaster />
          </Providers>
        </ErrorBoundary>
      </body>
    </html>
  );
}