import { EmptyLiveState } from "@/components/empty-live-state";

export function generateStaticParams() {
  return [];
}

export default function RecommendationPage() {
  return (
    <EmptyLiveState
      title="No saved recommendation detail"
      description="Open Next actions from a live analyze on the dashboard. Seeded demo recommendations have been removed."
    />
  );
}
