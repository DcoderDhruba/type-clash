import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "bootstrap-icons/font/bootstrap-icons.css";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { UserProvider } from "@/components/UserProvider";
import { getCurrentUser } from "@/server/auth";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TypeClash",
  description: "A minimal, fast typing speed test.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body
        className="flex h-dvh flex-col overflow-y-auto bg-bg text-text"
        suppressHydrationWarning
      >
        <UserProvider user={user}>
          <Navbar user={user} />
          {children}
        </UserProvider>
      </body>
    </html>
  );
}
