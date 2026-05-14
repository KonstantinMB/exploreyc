import { ProductRoadmap } from '../components/ProductRoadmap';

export function RoadmapPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">
            <span className="font-mono text-[#FB651E]">&gt;</span> Product Roadmap
          </h1>
          <p className="text-muted-foreground font-mono">
            Features we're building and what's coming next
          </p>
        </div>

        {/* Roadmap Content */}
        <ProductRoadmap />
      </div>
    </div>
  );
}
