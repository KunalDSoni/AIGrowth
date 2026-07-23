import { Suspense } from "react";
import { Brand } from "@/components/brand";
import { OnboardingFlow } from "@/components/onboarding-flow";
export default function Onboarding(){return <main><header className="container landing-nav"><Brand/><span className="pill">Free demo audit</span></header><Suspense><OnboardingFlow/></Suspense></main>}
