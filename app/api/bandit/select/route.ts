import { NextResponse } from "next/server";
import { getBanditStore } from "@/lib/bandit/store";
import { posteriorMeans, selectArm, trafficShares } from "@/lib/bandit/thompson";
import {
  BANDIT_COOKIE,
  banditCookieHeader,
  hashVisitorId,
  newVisitorId,
  parseCookieHeader,
} from "@/lib/bandit/visitor";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const started = performance.now();
  const url = new URL(request.url);
  const experimentId = url.searchParams.get("experiment") ?? "landing-cro-v1";
  const cookies = parseCookieHeader(request.headers.get("cookie"));
  const visitorId = cookies[BANDIT_COOKIE] ? hashVisitorId(cookies[BANDIT_COOKIE]) : newVisitorId();

  const store = getBanditStore();
  const experiment = await store.getOrCreateDefault(experimentId);
  const selection = selectArm(experiment, visitorId);
  await store.save(experiment);

  const elapsedMs = performance.now() - started;
  const response = NextResponse.json({
    ...selection,
    visitorId,
    trafficShares: trafficShares(experiment),
    posteriorMeans: posteriorMeans(experiment),
    arms: experiment.arms.map((a) => ({ id: a.id, label: a.label, alpha: a.alpha, beta: a.beta })),
    elapsedMs: Math.round(elapsedMs * 1000) / 1000,
  });
  if (!cookies[BANDIT_COOKIE]) {
    response.headers.set("Set-Cookie", banditCookieHeader(visitorId));
  }
  return response;
}
