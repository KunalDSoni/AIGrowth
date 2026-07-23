"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Globe2, LoaderCircle } from "lucide-react";
import { onboardingSchema } from "@/lib/security/url";
import { track } from "@/lib/analytics/client";

const steps = [
  { title: "Let’s start with your website", sub: "We’ll use it to understand what you offer.", fields: [{ key: "website", label: "Website URL", placeholder: "yourwebsite.com" }, { key: "businessName", label: "Business name", placeholder: "Your business name" }] },
  { title: "Who do you help?", sub: "This keeps recommendations relevant to the business—not just the website.", fields: [{ key: "industry", label: "Industry", placeholder: "Accounting and bookkeeping" }, { key: "audience", label: "Target customer", placeholder: "Small businesses and medical clinics" }] },
  { title: "Where are you growing?", sub: "Search behavior and opportunities change by market.", fields: [{ key: "country", label: "Primary market", placeholder: "Australia" }, { key: "goal", label: "Main conversion goal", placeholder: "Qualified consultation leads" }] },
  { title: "How should we plan?", sub: "Budget and maturity help us recommend realistic work.", fields: [{ key: "budget", label: "Monthly marketing budget", placeholder: "$1,000–$3,000" }, { key: "maturity", label: "Marketing maturity", placeholder: "Some activity, no clear system" }] },
  { title: "Give the AI your voice", sub: "Optional competitor context makes the analysis more specific.", fields: [{ key: "competitors", label: "Competitors (optional)", placeholder: "Competitor one, competitor two" }, { key: "tone", label: "Preferred tone", placeholder: "Professional, warm and plain-spoken" }] },
];

const defaults: Record<string, string> = { website: "", businessName: "", industry: "", audience: "", country: "", goal: "", budget: "", maturity: "", competitors: "", tone: "" };

export function OnboardingFlow() {
  const router = useRouter();
  const search = useSearchParams();
  const [step, setStep] = useState(0);
  const [data, setData] = useState(defaults);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const url = search.get("url");
    if (url) setData((current) => ({ ...current, website: url }));
    setReady(true);
  }, [search]);

  const continueFlow = () => {
    const fields = steps[step].fields.filter((field) => field.key !== "competitors");
    if (fields.some((field) => !data[field.key]?.trim())) {
      setError("Complete the fields above to continue.");
      return;
    }
    setError("");
    if (step < steps.length - 1) {
      setStep((current) => current + 1);
      return;
    }
    const parsed = onboardingSchema.safeParse(data);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check your details.");
      return;
    }
    setLoading(true);
    localStorage.setItem("opengrowth:onboarding", JSON.stringify(parsed.data));
    track("audit_started", { mode: "demo" });
    setTimeout(() => router.push("/analysis"), 500);
  };

  return <div className="onboard-shell"><div className="onboard-top"><span className="fine">STEP {step + 1} OF {steps.length}</span><div className="progress"><span style={{ width: `${((step + 1) / steps.length) * 100}%` }} /></div></div><div className="onboard-card"><div className="onboard-icon">{loading ? <LoaderCircle className="spin" /> : <Globe2 />}</div><h1 className="serif">{loading ? "Preparing your analysis…" : steps[step].title}</h1><p className="muted">{loading ? "Saving the business context for a more useful audit." : steps[step].sub}</p>{!loading && <div className="field-stack">{steps[step].fields.map((field) => <label key={field.key}><span>{field.label}</span><input className="input" value={data[field.key]} placeholder={field.placeholder} onChange={(event) => setData({ ...data, [field.key]: event.target.value })} /></label>)}</div>}{error && <p className="form-error" role="alert">{error}</p>}<div className="onboard-actions">{step > 0 && !loading ? <button className="btn btn-ghost" onClick={() => setStep((current) => current - 1)}><ArrowLeft size={17} /> Back</button> : <span />}<button className="btn btn-primary" onClick={continueFlow} disabled={loading || !ready}>{step === steps.length - 1 ? "Start my analysis" : "Continue"} {step === steps.length - 1 ? <Check size={17} /> : <ArrowRight size={17} />}</button></div></div><p className="fine" style={{ textAlign: "center" }}>Your URL is validated and private network addresses are blocked.</p></div>;
}
