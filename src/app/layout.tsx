import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "bootstrap-icons/font/bootstrap-icons.css";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { UserProvider } from "@/components/UserProvider";
import { getCurrentUser } from "@/server/auth";
import { siteUrl } from "@/lib/site";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: siteUrl,
  title: {
    default: "Free Online Typing Speed Test | TypeChaze",
    template: "%s | TypeChaze",
  },
  description:
    "Test your typing speed for free. Measure words per minute and accuracy, compete on the leaderboard, and race friends in real time.",
  applicationName: "TypeChaze",
  openGraph: {
    type: "website",
    siteName: "TypeChaze",
    title: "Free Online Typing Speed Test | TypeChaze",
    description:
      "Improve your typing speed, track your WPM, and challenge friends in a free online typing test.",
    images: ["/typechaze.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Free Online Typing Speed Test | TypeChaze",
    description:
      "Improve your typing speed, track your WPM, and challenge friends in a free online typing test.",
    images: ["/typechaze.png"],
  },
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
