import { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import { motion } from 'framer-motion';
import L from 'leaflet';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { useApp } from '../contexts/AppContext';
import { Globe, MapPin, Map as MapIcon } from 'lucide-react';

// Fix for default marker icon
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

// Custom marker icons
const createCustomIcon = (isHiring: boolean, isTop: boolean) => {
  const color = isTop ? '#FFC107' : isHiring ? '#4CAF50' : '#FF6600';
  return L.divIcon({
    className: 'custom-div-icon',
    html: `
      <div style="
        background-color: ${color};
        width: 28px;
        height: 28px;
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 3px 6px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        font-weight: bold;
        color: white;
      ">${isTop ? '⭐' : isHiring ? '💼' : '🚀'}</div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
};

interface MapControlsProps {
  onRegionClick: (region: { lat: number; lng: number; zoom: number }) => void;
}

function MapControls({
  onRegionClick,
  onMyLocation,
}: MapControlsProps & { onMyLocation?: () => void }) {
  const regions = [
    { name: 'Europe', lat: 50.0, lng: 10.0, zoom: 4 },
    { name: 'US', lat: 37.0902, lng: -95.7129, zoom: 4 },
    { name: 'Asia', lat: 34.0479, lng: 100.6197, zoom: 3 },
    { name: 'Africa', lat: -8.7832, lng: 34.5085, zoom: 3 },
    { name: 'World', lat: 20.0, lng: 0.0, zoom: 2 },
  ];

  return (
    <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2">
      {onMyLocation && (
        <Button
          size="sm"
          variant="secondary"
          className="shadow-lg backdrop-blur bg-[#FF6600]/10 hover:bg-[#FF6600]/20 text-[#FF6600] border-[#FF6600]/30"
          onClick={onMyLocation}
        >
          <MapPin className="h-4 w-4 mr-2" />
          Near Me
        </Button>
      )}
      {regions.map((region) => (
        <Button
          key={region.name}
          size="sm"
          variant="secondary"
          className="shadow-lg backdrop-blur"
          onClick={() => onRegionClick(region)}
        >
          <Globe className="h-4 w-4 mr-2" />
          {region.name}
        </Button>
      ))}
    </div>
  );
}

function MapUpdater({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();

  useEffect(() => {
    map.setView(center, zoom, { animate: true });
  }, [center, zoom, map]);

  return null;
}

export function EnhancedMap() {
  const { companies, setSelectedCompany, loading } = useApp();
  const [mapCenter, setMapCenter] = useState<[number, number]>([50.0, 10.0]);
  const [mapZoom, setMapZoom] = useState(4);
  const [batchFilter, setBatchFilter] = useState('');
  const [hiringFilter, setHiringFilter] = useState<boolean | undefined>(undefined);
  const [industryFilter, setIndustryFilter] = useState('');

  // Filter companies with valid coordinates
  const companiesWithCoords = useMemo(() => {
    return companies.filter((c) => c.latitude && c.longitude);
  }, [companies]);

  // Apply filters
  const filteredCompanies = useMemo(() => {
    return companiesWithCoords.filter((company) => {
      if (batchFilter && company.batch !== batchFilter) return false;
      if (hiringFilter !== undefined && company.is_hiring !== hiringFilter) return false;
      if (industryFilter && company.industry?.toLowerCase() !== industryFilter.toLowerCase()) return false;
      return true;
    });
  }, [companiesWithCoords, batchFilter, hiringFilter, industryFilter]);

  // Get unique batches and industries for filter
  const uniqueBatches = useMemo(() => {
    const batches = new Set(companies.map((c) => c.batch).filter(Boolean));
    return Array.from(batches).sort().reverse();
  }, [companies]);

  const uniqueIndustries = useMemo(() => {
    const industries = new Set(
      companies
        .map((c) => c.industry)
        .filter(Boolean)
        .slice(0, 15)
    );
    return Array.from(industries).sort();
  }, [companies]);

  const handleRegionClick = (region: { lat: number; lng: number; zoom: number }) => {
    setMapCenter([region.lat, region.lng]);
    setMapZoom(region.zoom);
  };

  const handleMyLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setMapCenter([pos.coords.latitude, pos.coords.longitude]);
          setMapZoom(8);
        },
        () => {
          // Fallback to Europe if denied
          setMapCenter([50.0, 10.0]);
          setMapZoom(4);
        }
      );
    }
  };

  // Calculate stats
  const europeanCompanies = filteredCompanies.filter(
    (c) => c.latitude! > 35 && c.latitude! < 71 && c.longitude! > -10 && c.longitude! < 40
  );
  const usCompanies = filteredCompanies.filter(
    (c) => c.latitude! > 24 && c.latitude! < 50 && c.longitude! > -125 && c.longitude! < -65
  );

  if (loading) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <motion.div
            className="flex flex-col items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-xl bg-[#FF6600]/20">
              <MapIcon className="h-8 w-8 text-[#FF6600]" />
            </div>
            <p className="font-mono text-muted-foreground">Loading companies for map...</p>
            <p className="mt-2 font-mono text-xs text-muted-foreground">
              {companiesWithCoords.length > 0
                ? `${companiesWithCoords.length.toLocaleString()} companies with coordinates`
                : 'Fetching geo data...'}
            </p>
          </motion.div>
        </CardContent>
      </Card>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
    >
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="flex items-center gap-2">
                <MapIcon className="h-5 w-5 text-[#FF6600]" />
                Interactive Company Map
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1 font-mono">
                {filteredCompanies.length.toLocaleString()} companies plotted •{' '}
                {europeanCompanies.length} in Europe • {usCompanies.length} in US
              </p>
            </div>

            <div className="flex gap-2">
              <div className="flex items-center gap-2 text-xs">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-[#FFC107] border-2 border-white"></div>
                  <span>Top</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-[#4CAF50] border-2 border-white"></div>
                  <span>Hiring</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-[#FF6600] border-2 border-white"></div>
                  <span>Standard</span>
                </div>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-2 mt-4">
            <select
              className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm font-mono"
              value={batchFilter}
              onChange={(e) => setBatchFilter(e.target.value)}
            >
              <option value="">All Batches</option>
              {uniqueBatches.slice(0, 10).map((batch) => (
                <option key={batch} value={batch}>
                  {batch}
                </option>
              ))}
            </select>

            <select
              className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm font-mono"
              value={hiringFilter === undefined ? '' : hiringFilter ? 'true' : 'false'}
              onChange={(e) => {
                const value = e.target.value;
                setHiringFilter(value === '' ? undefined : value === 'true');
              }}
            >
              <option value="">All Status</option>
              <option value="true">Hiring Only</option>
              <option value="false">Not Hiring</option>
            </select>

            <select
              className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm font-mono"
              value={industryFilter}
              onChange={(e) => setIndustryFilter(e.target.value)}
            >
              <option value="">All Industries</option>
              {uniqueIndustries.map((ind) => (
                <option key={ind} value={ind}>
                  {ind}
                </option>
              ))}
            </select>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="h-[700px] relative rounded-b-lg overflow-hidden border-t">
            <MapContainer
              center={mapCenter}
              zoom={mapZoom}
              style={{ height: '100%', width: '100%' }}
              scrollWheelZoom={true}
              className="z-0"
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              <MapUpdater center={mapCenter} zoom={mapZoom} />

              <MarkerClusterGroup
                chunkedLoading
                maxClusterRadius={50}
                spiderfyOnMaxZoom={true}
                showCoverageOnHover={false}
              >
                {filteredCompanies.map((company) => {
                  if (!company.latitude || !company.longitude) return null;

                  return (
                    <Marker
                      key={company.id}
                      position={[company.latitude, company.longitude]}
                      icon={createCustomIcon(company.is_hiring, company.top_company)}
                      eventHandlers={{
                        click: () => setSelectedCompany(company),
                      }}
                    >
                      <Popup>
                        <div className="p-2 min-w-[200px]">
                          <button
                            onClick={() => setSelectedCompany(company)}
                            className="w-full text-left hover:underline"
                          >
                            <h3 className="font-bold text-sm mb-1">{company.name}</h3>
                          </button>

                          {company.is_hiring && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 mb-2">
                              💼 Hiring
                            </span>
                          )}

                          <p className="text-xs text-gray-600 mb-2 line-clamp-2">
                            {company.one_liner}
                          </p>

                          <div className="text-xs text-gray-500 space-y-1">
                            <div>📍 {company.all_locations || company.country}</div>
                            <div>🎓 {company.batch}</div>
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}
              </MarkerClusterGroup>
            </MapContainer>

            <MapControls onRegionClick={handleRegionClick} onMyLocation={handleMyLocation} />
          </div>

          <div className="px-6 py-3 bg-muted/50 text-xs text-muted-foreground font-mono border-t">
            💡 Tip: Click markers to view details • Use region buttons to navigate • Clusters show company density
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
