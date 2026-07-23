# AI Visibility Engine

## Mission

Measure how a brand, competitors, and source citations appear in AI-generated answers using timestamped observations, prompt variants, sample sizes, and transparent uncertainty.

## Epics

| Epic ID | Epic | Outcome |
|---|---|---|
| AIV-001 | Prompt Family Model | Define canonical prompts grouped by user intent and business topic |
| AIV-002 | Prompt Variant Generator | Generate controlled variants by geography, persona, specificity, and wording |
| AIV-003 | AI Platform Provider Contract | Normalize observations from mock and future real providers |
| AIV-004 | Observation Run Lifecycle | Run, store, retry, fail, and inspect AI observation batches |
| AIV-005 | Raw Answer Storage | Persist raw answers safely with platform, model, prompt, locale, and timestamp |
| AIV-006 | Mention Extraction | Extract brand and competitor mentions with confidence |
| AIV-007 | Citation Extraction | Extract cited URLs and domains from answer outputs |
| AIV-008 | Sentiment and Prominence Signals | Classify positive, neutral, negative, absent, and prominence levels |
| AIV-009 | Variability and Sample Size Metrics | Calculate mention rate, citation rate, answer consistency, and run-to-run variance |
| AIV-010 | AI Visibility Evidence UI | Show raw observations, labels, sample size, and uncertainty |
| AIV-011 | AI Visibility Gap Detection | Identify absent brand, competitor dominance, missing citations, and weak source coverage |
| AIV-012 | AI Visibility Recommendation Bridge | Convert gaps into evidence-backed recommendations |

## First Vertical Slice

Start with the smallest slice that creates evidence, produces a decision, and gives the user a meaningful next action.
