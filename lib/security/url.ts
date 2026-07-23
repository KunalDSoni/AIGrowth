import { z } from "zod";

const blockedHosts = /^(localhost|0\.0\.0\.0|127(?:\.\d{1,3}){3}|10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|169\.254(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2}|\[?::1\]?)$/i;

export const publicWebsiteSchema = z.string().trim().min(1, "Enter your website URL").refine((value) => !/^[a-z][a-z0-9+.-]*:\/\//i.test(value) || /^https?:\/\//i.test(value), "Only HTTP and HTTPS website addresses are supported").transform((value) => {
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}).pipe(z.url("Enter a valid website URL").refine((value) => {
  const url = new URL(value);
  return ["http:", "https:"].includes(url.protocol) && !blockedHosts.test(url.hostname) && !url.hostname.endsWith(".local");
}, "Use a public website address; local and private networks are blocked"));

export const onboardingSchema = z.object({
  website: publicWebsiteSchema,
  businessName: z.string().trim().min(2, "Enter a business name").max(100),
  industry: z.string().trim().min(2),
  audience: z.string().trim().min(2),
  country: z.string().trim().min(2),
  goal: z.string().trim().min(2),
  budget: z.string().trim().min(1),
  maturity: z.string().trim().min(1),
  competitors: z.string().trim().max(500).optional(),
  tone: z.string().trim().min(1),
});

export type OnboardingInput = z.input<typeof onboardingSchema>;
