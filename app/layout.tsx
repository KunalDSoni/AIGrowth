import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: { default: "OpenGrowth AI", template: "%s · OpenGrowth AI" }, description: "AI-native SEO and marketing intelligence that turns website data into clear growth actions." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
