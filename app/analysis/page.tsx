import { Brand } from "@/components/brand";
import { AnalysisProgress } from "@/components/analysis-progress";

export default function Analysis() {
  return (
    <main>
      <header className="container landing-nav">
        <Brand />
      </header>
      <div className="container">
        <AnalysisProgress />
      </div>
    </main>
  );
}
