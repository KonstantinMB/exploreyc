import { lazy, Suspense } from 'react';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import { PageHeader } from '../components/ui/PageHeader';
import { DotPattern } from '../components/ui/dot-pattern';
import { CompanyDetailModal } from '../components/CompanyDetailModal';
import { useApp } from '../contexts/AppContext';

const WorldMap = lazy(() => import('../components/WorldMap'));

export function MapPage() {
  const { selectedCompany, setSelectedCompany } = useApp();

  return (
    <div className="relative min-h-screen bg-background overflow-x-hidden">
      <Helmet>
        <title>Interactive World Map | ExploreYC</title>
        <meta
          name="description"
          content="Explore Y Combinator companies across the globe on an interactive 2D map and 3D globe — density hotspots, batch timeline, and a fly-to tour of the top startup hubs."
        />
      </Helmet>

      <DotPattern color="hsl(var(--primary) / 0.12)" size={24} radius={0.5} />

      <div className="container relative mx-auto px-4 py-8 max-w-[1600px]">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <PageHeader
            command="$ map --world --interactive"
            title="Interactive World Map"
            subtitle="Every Y Combinator company on the map — toggle the 3D globe, scrub the batch timeline, or take a tour of the top startup hubs."
          />
        </motion.div>

        <Suspense
          fallback={
            <div className="h-[350px] sm:h-[500px] md:h-[600px] lg:h-[720px] rounded-lg border bg-muted/40 animate-pulse flex items-center justify-center font-mono text-sm text-muted-foreground">
              Loading world map…
            </div>
          }
        >
          <WorldMap />
        </Suspense>
      </div>

      {selectedCompany && (
        <CompanyDetailModal
          company={selectedCompany}
          open={true}
          onClose={() => setSelectedCompany(null)}
        />
      )}
    </div>
  );
}
