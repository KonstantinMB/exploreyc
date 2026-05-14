import { OptimizedMap } from '../components/OptimizedMap';
import { CompaniesBrowser } from '../components/CompaniesBrowser';
import { CompanyDetailModal } from '../components/CompanyDetailModal';
import { MapLocationSVG, CompanyGridSVG } from '../components/illustrations/CustomSVGs';
import { useApp } from '../contexts/AppContext';

export function ExplorePage() {
  const { selectedCompany, setSelectedCompany, stats } = useApp();

  return (
    <div className="min-h-screen bg-background">
      {/* Map Section */}
      <section className="border-b border-border">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-3 mb-6">
            <MapLocationSVG className="w-10 h-10 sm:w-12 sm:h-12 flex-shrink-0" />
            <div>
              <h1 className="text-xl sm:text-2xl font-bold">Interactive World Map</h1>
              <p className="text-xs sm:text-sm text-muted-foreground font-mono">
                Discover YC companies around the globe
              </p>
            </div>
          </div>
          <OptimizedMap />
        </div>
      </section>

      {/* Companies List Section */}
      <section>
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center gap-3 mb-6">
            <CompanyGridSVG className="w-10 h-10 sm:w-12 sm:h-12 flex-shrink-0" />
            <div>
              <h2 className="text-xl sm:text-2xl font-bold">Browse All Companies</h2>
              <p className="text-xs sm:text-sm text-muted-foreground font-mono">
                Search, filter, and explore {(stats?.total_companies ?? 0).toLocaleString()} YC startups
              </p>
            </div>
          </div>
          <CompaniesBrowser refreshTrigger={stats?.total_companies || 0} />
        </div>
      </section>

      {/* Company Detail Modal */}
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
