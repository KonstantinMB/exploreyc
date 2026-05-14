import { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import { motion } from 'framer-motion';
import L from 'leaflet';
import { Card, CardContent, CardHeader } from './ui/card';
import { Button } from './ui/button';
import { useApp } from '../contexts/AppContext';
import { Info, X, Award, Briefcase, MapPin, GraduationCap, Users } from 'lucide-react';
import type { Company } from '../lib/api';

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

// Logo-based marker icon
const createLogoIcon = (company: Company) => {
  const borderColor = company.top_company ? '#FFC107' : company.is_hiring ? '#4CAF50' : '#FB651E';
  const logoUrl = company.small_logo_thumb_url;

  return L.divIcon({
    className: 'logo-marker-icon',
    html: `
      <div style="
        width: 32px;
        height: 32px;
        border-radius: 50%;
        border: 2px solid ${borderColor};
        background: white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        position: relative;
      ">
        ${logoUrl
          ? `<img src="${logoUrl}" alt="${company.name}" style="width: 24px; height: 24px; object-fit: contain;" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
             <div style="display: none; width: 24px; height: 24px; background: ${borderColor}; color: white; align-items: center; justify-content: center; border-radius: 4px; font-weight: bold; font-size: 14px;">${company.name.charAt(0)}</div>`
          : `<div style="width: 24px; height: 24px; background: ${borderColor}; color: white; display: flex; align-items: center; justify-content: center; border-radius: 4px; font-weight: bold; font-size: 14px;">${company.name.charAt(0)}</div>`
        }
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
};

// Optimized cluster icon
const createClusterIcon = (cluster: any) => {
  const count = cluster.getChildCount();
  const size = count > 50 ? 50 : count > 20 ? 40 : 32;

  return L.divIcon({
    html: `
      <div style="
        background: linear-gradient(135deg, #FB651E 0%, #ff8533 100%);
        width: ${size}px;
        height: ${size}px;
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 3px 10px rgba(255, 102, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: ${size > 40 ? '16px' : '14px'};
        font-weight: bold;
        color: white;
        font-family: ui-monospace, monospace;
      ">${count}</div>
    `,
    className: 'optimized-cluster-icon',
    iconSize: [size, size],
  });
};

interface MapControlsProps {
  onRegionClick: (region: { lat: number; lng: number; zoom: number }) => void;
}

function MapControls({ onRegionClick }: MapControlsProps) {
  const regions = [
    { name: '🇺🇸 US', lat: 37.0902, lng: -95.7129, zoom: 4 },
    { name: '🇪🇺 Europe', lat: 50.0, lng: 10.0, zoom: 4 },
    { name: '🌏 Asia', lat: 34.0479, lng: 100.6197, zoom: 3 },
    { name: '🌍 World', lat: 20.0, lng: 0.0, zoom: 2 },
  ];

  return (
    <div className="absolute bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:bottom-auto sm:top-4 z-[1000] flex flex-row sm:flex-col gap-2 flex-wrap justify-center sm:justify-end">
      {regions.map((region) => (
        <Button
          key={region.name}
          size="sm"
          variant="secondary"
          className="shadow-lg backdrop-blur text-xs sm:text-sm min-h-[36px]"
          onClick={() => onRegionClick(region)}
        >
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

// Get last N batches
function getLastNBatches(companies: Company[], n: number): string[] {
  const batches = new Set(companies.map((c) => c.batch).filter(Boolean));
  const sortedBatches = Array.from(batches).sort().reverse();
  return sortedBatches.slice(0, n);
}

export function OptimizedMap() {
  const { companies, totalMapCompanies, loadAllMapCompanies, setSelectedCompany } = useApp();
  const [mapCenter, setMapCenter] = useState<[number, number]>([20.0, 0.0]); // Default to world view
  const [mapZoom, setMapZoom] = useState(2); // Default to world zoom level
  const [showAllBatches, setShowAllBatches] = useState(false);
  const [showBanner, setShowBanner] = useState(true);
  const [loadingAll, setLoadingAll] = useState(false);

  // Get last 4 batches
  const last4Batches = useMemo(() => {
    return getLastNBatches(companies, 4);
  }, [companies]);

  // Filter companies - only last 4 batches by default
  const mapCompanies = useMemo(() => {
    let filtered = companies.filter((c) => c.latitude && c.longitude);

    if (!showAllBatches) {
      filtered = filtered.filter((c) => last4Batches.includes(c.batch || ''));
    }

    return filtered;
  }, [companies, showAllBatches, last4Batches]);

  const handleRegionClick = (region: { lat: number; lng: number; zoom: number }) => {
    setMapCenter([region.lat, region.lng]);
    setMapZoom(region.zoom);
  };

  // Calculate stats
  const europeanCompanies = mapCompanies.filter(
    (c) => c.latitude! > 35 && c.latitude! < 71 && c.longitude! > -10 && c.longitude! < 40
  );
  const usCompanies = mapCompanies.filter(
    (c) => c.latitude! > 24 && c.latitude! < 50 && c.longitude! > -125 && c.longitude! < -65
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
    >
      <Card>
        <CardHeader className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-muted-foreground font-mono">
                {mapCompanies.length.toLocaleString()} companies •{' '}
                {europeanCompanies.length} in Europe • {usCompanies.length} in US
              </p>
            </div>

            <div className="flex gap-2 flex-shrink-0">
              <div className="flex items-center gap-1 sm:gap-2 text-xs flex-wrap">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-[#FFC107] border-2 border-white"></div>
                  <span>Top</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-[#4CAF50] border-2 border-white"></div>
                  <span>Hiring</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-[#FB651E] border-2 border-white"></div>
                  <span>Standard</span>
                </div>
              </div>
            </div>
          </div>

          {/* Info Banner */}
          {showBanner && !showAllBatches && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 bg-[#FB651E]/10 border border-[#FB651E]/30 rounded-lg p-3"
            >
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-[#FB651E] flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">
                    Showing Recent Batches for Better Performance
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 font-mono">
                    Displaying {mapCompanies.length.toLocaleString()} companies from:{' '}
                    <span className="font-semibold">{last4Batches.join(', ')}</span>
                  </p>
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-[#FB651E] hover:text-[#FB651E]/80 font-mono text-xs mt-2 disabled:opacity-50"
                    disabled={loadingAll}
                    onClick={async () => {
                      setShowAllBatches(true);
                      if (totalMapCompanies > companies.length) {
                        setLoadingAll(true);
                        await loadAllMapCompanies();
                        setLoadingAll(false);
                      }
                    }}
                  >
                    {loadingAll ? 'Loading…' : `Show all ${totalMapCompanies.toLocaleString()} companies →`}
                  </Button>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => setShowBanner(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </motion.div>
          )}

          {showAllBatches && (
            <div className="mt-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">
                  Showing all {mapCompanies.length.toLocaleString()} companies
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAllBatches(false)}
                >
                  Show recent batches only
                </Button>
              </div>
            </div>
          )}
        </CardHeader>

        <CardContent className="p-0">
          <div className="h-[350px] sm:h-[500px] md:h-[600px] lg:h-[700px] min-h-[300px] relative rounded-b-lg overflow-hidden border-t">
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
                maxClusterRadius={60}
                spiderfyOnMaxZoom={true}
                showCoverageOnHover={false}
                iconCreateFunction={createClusterIcon}
                animate={true}
              >
                {mapCompanies.map((company) => (
                  <Marker
                    key={company.id}
                    position={[company.latitude!, company.longitude!]}
                    icon={createLogoIcon(company)}
                    eventHandlers={{
                      click: () => setSelectedCompany(company),
                    }}
                  >
                    <Popup>
                      <div className="p-3 min-w-[180px] max-w-[85vw] sm:max-w-[280px]">
                        {company.small_logo_thumb_url && (
                          <img
                            src={company.small_logo_thumb_url}
                            alt={company.name}
                            className="w-12 h-12 object-contain mb-2 rounded"
                          />
                        )}

                        <h3 className="font-bold text-base mb-2">{company.name}</h3>

                        <div className="flex gap-2 mb-2">
                          {company.is_hiring && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">
                              <Briefcase className="w-3 h-3" />
                              Hiring
                            </span>
                          )}
                          {company.top_company && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                              <Award className="w-3 h-3" />
                              Top Company
                            </span>
                          )}
                        </div>

                        <p className="text-sm text-gray-700 mb-3 line-clamp-3">
                          {company.one_liner}
                        </p>

                        <div className="text-xs text-gray-600 space-y-1 mb-3">
                          <div className="flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                            <span>{company.all_locations || company.country}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <GraduationCap className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                            <span>{company.batch}</span>
                          </div>
                          {company.team_size && (
                            <div className="flex items-center gap-1.5">
                              <Users className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                              <span>{company.team_size} people</span>
                            </div>
                          )}
                        </div>

                        <button
                          onClick={() => setSelectedCompany(company)}
                          className="w-full bg-[#FB651E] hover:bg-[#ff8533] text-white font-medium py-2 px-4 rounded text-sm transition-colors"
                        >
                          View Full Details
                        </button>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MarkerClusterGroup>
            </MapContainer>

            <MapControls onRegionClick={handleRegionClick} />
          </div>

          <div className="px-4 sm:px-6 py-3 bg-muted/50 text-xs text-muted-foreground font-mono border-t">
            💡 Click any marker to see company details • Orange clusters show density • Region buttons for quick navigation
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
