import type { Metadata, Viewport } from "next";
import { ConvexClientProvider } from "@/components/ConvexClientProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "bonbon — Your Recipe Collection",
  description: "A beautiful place to save your favorite YouTube recipes",
  applicationName: "bonbon",
  appleWebApp: {
    capable: true,
    title: "bonbon",
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Required for env(safe-area-inset-*) to work on notched iPhones
  viewportFit: "cover",
  themeColor: "#FFF3E9",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <ConvexClientProvider>
          <div className="max-w-2xl mx-auto px-4 py-8 sm:px-6 sm:py-12">
            {children}
          </div>
        </ConvexClientProvider>
      </body>
    </html>
  );
}
