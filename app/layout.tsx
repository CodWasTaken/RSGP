import type {Metadata} from "next";
import "./style.css";
export const metadata:Metadata={title:"RSGP — Roblox Studio Game Printer",description:"Build Roblox games from a connected AI workspace."};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>;}
