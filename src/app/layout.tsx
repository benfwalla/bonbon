import type { Metadata } from "next";
import { ConvexClientProvider } from "@/components/ConvexClientProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "bonbon — Your Recipe Collection",
  description: "A beautiful place to save your favorite YouTube recipes",
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
          <div className="max-w-5xl mx-auto px-6 py-12">
            {children}
          </div>
        </ConvexClientProvider>
      </body>
    </html>
  );
}
