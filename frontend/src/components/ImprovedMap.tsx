import { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import { motion, AnimatePresence } from 'framer-motion';
import L from 'leaflet';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { useApp } from '../contexts/AppContext';
import { Map as MapIcon, List, X, Search, Building2 } from 'lucide-react';
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

// Custom marker icons - shows company info when zoomed in
const createCustomIcon = (
  company: Company,
  zoom: number,
  isHiring: boolean,
  isTop: boolean
) => {
  const color = isTop ? '#FFC107' : isHiring ? '#4CAF50' : '#FF6600';

  // Show detailed info when zoomed in (level 10+)
  if (zoom >= 10) {
    const logoUrl = company.small_logo_thumb_url;
    return L.divIcon({
      className: 'custom-company-marker',
      html: `
        <div style="
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
        ">
          <div style="
            background: white;
            border: 2px solid ${color};
            border-radius: 8px;
            padding: 6px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 4px;
            min-width: 80px;
            max-width: 120px;
          ">
            ${
              logoUrl
                ? `<img src="${logoUrl}" alt="${company.name}" style="width: 32px; height: 32px; object-fit: contain; border-radius: 4px;" />`
                : `<div style="width: 32px; height: 32px; background: ${color}; border-radius: 4px; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 16px;">${company.name.charAt(0)}</div>`
            }
            <div style="
              font-size: 10px;
              font-weight: 600;
              text-align: center;
              color: #333;
              line-height: 1.2;
              max-width: 110px;
              overflow: hidden;
              text-overflow: ellipsis;
              display: -webkit-box;
              -webkit-line-clamp: 2;
              -webkit-box-orient: vertical;
              font-family: ui-sans-serif, system-ui, sans-serif;
            ">${company.name}</div>
            ${
              isHiring
                ? '<div style="background: #4CAF50; color: white; font-size: 8px; padding: 2px 4px; border-radius: 3px; font-weight: 600;">HIRING</div>'
                : ''
            }
          </div>
        </div>
      `,
      iconSize: [120, 80],
      iconAnchor: [60, 80],
    });
  }

  // Show simple dot when zoomed out
  return L.divIcon({
    className: 'custom-div-icon',
    html: `
      <div style="
        background-color: ${color};
        width: 20px;
        height: 20px;
        border-radius: 50%;
        border: 2px solid white;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      "></div>
    `,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
};

// Enhanced cluster icon with better visibility
const createClusterCustomIcon = (cluster: any) => {
  const count = cluster.getChildCount();
  let size = 40;
  let fontSize = '14px';

  if (count > 100) {
    size = 60;
    fontSize = '18px';
  } else if (count > 50) {
    size = 50;
    fontSize = '16px';
  }

  return L.divIcon({
    html: `
      <div style="
        background: linear-gradient(135deg, #FF6600 0%, #ff8533 100%);
        width: ${size}px;
        height: ${size}px;
        border-radius: 50%;
        border: 4px solid white;
        box-shadow: 0 4px 12px rgba(255, 102, 0, 0.4);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: ${fontSize};
        font-weight: bold;
        color: white;
        font-family: ui-monospace, monospace;
      ">${count}</div>
    `,
    className: 'custom-cluster-icon',
    iconSize: [size, size],
  });
};

interface MapControlsProps {
  onRegionClick: (region: { lat: number; lng: number; zoom: number }) => void;
  onToggleList: () => void;
  showList: boolean;
}

function MapControls({ onRegionClick, onToggleList, showList }: MapControlsProps) {
  const regions = [
    { name: '🇺🇸 US', lat: 37.0902, lng: -95.7129, zoom: 4 },
    { name: '🇪🇺 Europe', lat: 50.0, lng: 10.0, zoom: 4 },
    { name: '🌏 Asia', lat: 34.0479, lng: 100.6197, zoom: 3 },
    { name: '🌍 World', lat: 20.0, lng: 0.0, zoom: 2 },
  ];

  return (
    <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2">
      <Button
        size="sm"
        variant={showList ? "default" : "secondary"}
        className="shadow-lg backdrop-blur"
        onClick={onToggleList}
      >
        <List className="h-4 w-4 mr-2" />
        {showList ? 'Hide' : 'Show'} List
      </Button>
      {regions.map((region) => (
        <Button
          key={region.name}
          size="sm"
          variant="secondary"
          className="shadow-lg backdrop-blur"
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

// Component to track visible companies in map bounds
function MapBoundsTracker({ onBoundsChange }: { onBoundsChange: (bounds: L.LatLngBounds) => void }) {
  const map = useMapEvents({
    moveend: () => {
      onBoundsChange(map.getBounds());
    },
    zoomend: () => {
      onBoundsChange(map.getBounds());
    },
  });

  useEffect(() => {
    onBoundsChange(map.getBounds());
  }, [map, onBoundsChange]);

  return null;
}

// Company list panel
interface CompanyListPanelProps {
  companies: Company[];
  onCompanyClick: (company: Company) => void;
  onClose: () => void;
}

function CompanyListPanel({ companies, onCompanyClick, onClose }: CompanyListPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'batch' | 'hiring'>('name');

  const filteredCompanies = useMemo(() => {
    let filtered = companies;

    if (searchQuery) {
      filtered = filtered.filter(
        (c) =>
          c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.one_liner?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.all_locations?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Sort
    filtered = [...filtered].sort((a, b) => {
      if (sortBy === 'hiring') {
        if (a.is_hiring && !b.is_hiring) return -1;
        if (!a.is_hiring && b.is_hiring) return 1;
      }
      if (sortBy === 'batch') {
        return (b.batch || '').localeCompare(a.batch || '');
      }
      return a.name.localeCompare(b.name);
    });

    return filtered;
  }, [companies, searchQuery, sortBy]);

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 20 }}
      className="absolute right-0 top-0 bottom-0 w-96 bg-background border-l shadow-2xl z-[1000] flex flex-col"
    >
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between bg-muted/50">
        <div>
          <h3 className="font-bold font-mono text-lg">Companies in View</h3>
          <p className="text-xs text-muted-foreground font-mono">
            {filteredCompanies.length} of {companies.length} companies
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Search and filters */}
      <div className="p-4 space-y-2 border-b bg-muted/30">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search companies..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 font-mono text-sm"
          />
        </div>

        <div className="flex gap-2">
          <select
            className="flex h-8 rounded-md border border-input bg-background px-2 text-xs font-mono flex-1"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
          >
            <option value="name">Sort: Name</option>
            <option value="batch">Sort: Batch</option>
            <option value="hiring">Sort: Hiring First</option>
          </select>
        </div>
      </div>

      {/* Company list */}
      <div className="flex-1 overflow-y-auto">
        {filteredCompanies.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <Building2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p className="font-mono text-sm">No companies found</p>
          </div>
        ) : (
          <div className="divide-y">
            {filteredCompanies.map((company) => (
              <button
                key={company.id}
                onClick={() => onCompanyClick(company)}
                className="w-full p-3 hover:bg-muted/50 transition-colors text-left"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-sm truncate">{company.name}</h4>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                      {company.one_liner}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground font-mono">
                      <span>📍 {company.all_locations || company.country}</span>
                      <span>•</span>
                      <span>{company.batch}</span>
                    </div>
                  </div>
                  {company.is_hiring && (
                    <span className="flex-shrink-0 px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                      Hiring
                    </span>
                  )}
                  {company.top_company && (
                    <span className="flex-shrink-0">⭐</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

export function ImprovedMap() {
  const { companies, setSelectedCompany, loading } = useApp();
  const [mapCenter, setMapCenter] = useState<[number, number]>([37.0902, -95.7129]);
  const [mapZoom, setMapZoom] = useState(4);
  const [batchFilter, setBatchFilter] = useState('');
  const [hiringFilter, setHiringFilter] = useState<boolean | undefined>(undefined);
  const [industryFilter, setIndustryFilter] = useState('');
  const [showList, setShowList] = useState(false);
  const [visibleCompanies, setVisibleCompanies] = useState<Company[]>([]);

  // Filter companies with valid coordinates
  const companiesWithCoords = useMemo(() => {
    return companies.filter((c) => c.latitude && c.longitude);
  }, [companies]);

  // Apply filters
  const filteredCompanies = useMemo(() => {
    return companiesWithCoords.filter((company) => {
      if (batchFilter && company.batch !== batchFilter) return false;
      if (hiringFilter !== undefined && company.is_hiring !== hiringFilter) return false;
      if (industryFilter && company.industry?.toLowerCase() !== industryFilter.toLowerCase())
        return false;
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

  const handleBoundsChange = (bounds: L.LatLngBounds) => {
    const visible = filteredCompanies.filter((company) => {
      if (!company.latitude || !company.longitude) return false;
      return bounds.contains([company.latitude, company.longitude]);
    });
    setVisibleCompanies(visible);
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
              <MapBoundsTracker onBoundsChange={handleBoundsChange} />

              <MarkerClusterGroup
                chunkedLoading
                maxClusterRadius={80}
                spiderfyOnMaxZoom={true}
                showCoverageOnHover={false}
                zoomToBoundsOnClick={false}
                spiderfyDistanceMultiplier={2}
                iconCreateFunction={createClusterCustomIcon}
              >
                {filteredCompanies.map((company) => {
                  if (!company.latitude || !company.longitude) return null;

                  return (
                    <Marker
                      key={company.id}
                      position={[company.latitude, company.longitude]}
                      icon={createCustomIcon(company, mapZoom, company.is_hiring, company.top_company)}
                      eventHandlers={{
                        click: () => setSelectedCompany(company),
                      }}
                    >
                      <Tooltip direction="top" offset={[0, -10]} opacity={0.95}>
                        <div style={{ minWidth: '150px' }}>
                          <div style={{ fontWeight: 'bold', marginBottom: '4px', fontSize: '12px' }}>
                            {company.name}
                          </div>
                          {company.is_hiring && (
                            <div style={{
                              backgroundColor: '#4CAF50',
                              color: 'white',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontSize: '10px',
                              display: 'inline-block',
                              marginBottom: '4px'
                            }}>
                              💼 HIRING
                            </div>
                          )}
                          <div style={{ fontSize: '10px', color: '#666', marginTop: '2px' }}>
                            {company.batch} • {company.all_locations || company.country}
                          </div>
                          <div style={{ fontSize: '9px', color: '#999', marginTop: '4px', fontStyle: 'italic' }}>
                            Click for details
                          </div>
                        </div>
                      </Tooltip>

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

            <MapControls
              onRegionClick={handleRegionClick}
              onToggleList={() => setShowList(!showList)}
              showList={showList}
            />

            <AnimatePresence>
              {showList && (
                <CompanyListPanel
                  companies={visibleCompanies}
                  onCompanyClick={(company) => {
                    setSelectedCompany(company);
                    setMapCenter([company.latitude!, company.longitude!]);
                    setMapZoom(12);
                  }}
                  onClose={() => setShowList(false)}
                />
              )}
            </AnimatePresence>
          </div>

          <div className="px-6 py-3 bg-muted/50 text-xs text-muted-foreground font-mono border-t">
            💡 Tip: Click "Show List" to see companies in current view • Orange numbers show company clusters • Click clusters to zoom in
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
