import Link from "next/link";
import { Sprout } from "lucide-react";
export function Brand({ href = "/" }: { href?: string }) { return <Link href={href} className="logo"><span className="logo-mark"><Sprout size={18}/></span><span>OpenGrowth <span style={{color:"var(--brand)"}}>AI</span></span></Link>; }
