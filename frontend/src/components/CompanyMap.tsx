import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { motion } from 'framer-motion';
import L from 'leaflet';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { apiClient } from '../lib/api';
import type { Company } from '../lib/api';
import { ExternalLink, Briefcase, MapPin, GraduationCap, Users, FileText } from 'lucide-react';

// Fix for default marker icon in React-Leaflet
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
const createCustomIcon = (isHiring: boolean) => {
  return L.divIcon({
    className: 'custom-div-icon',
    html: `
      <div style="background-color: ${isHiring ? '#4CAF50' : '#FF6600'};
                  width: 24px;
                  height: 24px;
                  border-radius: 50%;
                  border: 2px solid white;
                  box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
};

// Component to update map view to Europe
function EuropeView() {
  const map = useMap();

  useEffect(() => {
    // Center on Europe with good zoom level
    map.setView([50.0, 10.0], 4);
  }, [map]);

  return null;
}

interface CompanyMapProps {
  refreshTrigger?: number;
}

export function CompanyMap({ refreshTrigger }: CompanyMapProps) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<{ batch?: string; isHiring?: boolean }>({});

  useEffect(() => {
    loadMapData();
  }, [refreshTrigger, filter]);

  const loadMapData = async () => {
    setLoading(true);
    try {
      const response = await apiClient.getMapData(filter.batch, filter.isHiring);
      setCompanies(response.data.companies);
    } catch (error) {
      console.error('Failed to load map data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Count companies by region
  const europeanCompanies = companies.filter(
    (c) => c.latitude && c.longitude && c.latitude > 35 && c.latitude < 71 && c.longitude > -10 && c.longitude < 40
  );
  const usCompanies = companies.filter(
    (c) => c.latitude && c.longitude && c.latitude > 24 && c.latitude < 50 && c.longitude > -125 && c.longitude < -65
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
    >
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Company Locations Map</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {companies.length} companies • {europeanCompanies.length} in Europe • {usCompanies.length} in US
              </p>
            </div>

            <div className="flex gap-2 items-center text-xs">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-[#FF6600]"></div>
                <span>Standard</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-[#4CAF50]"></div>
                <span>Hiring</span>
              </div>
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <select
              className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
              onChange={(e) => setFilter({ ...filter, batch: e.target.value || undefined })}
            >
              <option value="">All Batches</option>
              <option value="Summer 2026">Summer 2026</option>
              <option value="Spring 2026">Spring 2026</option>
              <option value="Winter 2026">Winter 2026</option>
              <option value="Fall 2025">Fall 2025</option>
            </select>

            <select
              className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
              onChange={(e) => {
                const value = e.target.value;
                setFilter({
                  ...filter,
                  isHiring: value === '' ? undefined : value === 'true',
                });
              }}
            >
              <option value="">All Status</option>
              <option value="true">Hiring Only</option>
              <option value="false">Not Hiring</option>
            </select>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="h-[600px] flex items-center justify-center">
              <p>Loading map data...</p>
            </div>
          ) : (
            <div className="h-[600px] rounded-lg overflow-hidden border">
              <MapContainer
                center={[50.0, 10.0]}
                zoom={4}
                style={{ height: '100%', width: '100%' }}
                scrollWheelZoom={true}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                <EuropeView />

                {companies.map((company) => {
                  if (!company.latitude || !company.longitude) return null;

                  return (
                    <Marker
                      key={company.id}
                      position={[company.latitude, company.longitude]}
                      icon={createCustomIcon(company.is_hiring)}
                    >
                      <Popup>
                        <div className="p-2 min-w-[200px]">
                          <h3 className="font-bold text-sm mb-1">{company.name}</h3>

                          {company.is_hiring && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 mb-2">
                              <Briefcase className="h-3 w-3 mr-1" />
                              Hiring
                            </span>
                          )}

                          <p className="text-xs text-gray-600 mb-2">{company.one_liner}</p>

                          <div className="text-xs text-gray-500 space-y-1">
                            <div className="flex items-center gap-1.5">
                              <MapPin className="w-3 h-3 flex-shrink-0" />
                              <span>{company.all_locations || company.country}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <GraduationCap className="w-3 h-3 flex-shrink-0" />
                              <span>{company.batch}</span>
                            </div>
                            {company.team_size > 0 && (
                              <div className="flex items-center gap-1.5">
                                <Users className="w-3 h-3 flex-shrink-0" />
                                <span>{company.team_size} people</span>
                              </div>
                            )}
                          </div>

                          <div className="flex flex-wrap gap-2 mt-2">
                            {company.slug && (
                              <Link
                                to={`/company/${company.slug}`}
                                className="inline-flex items-center text-xs text-[#FF6600] hover:underline"
                              >
                                <FileText className="h-3 w-3 mr-1" />
                                View company
                              </Link>
                            )}
                            {company.website && (
                              <a
                                href={company.website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center text-xs text-[#FF6600] hover:underline"
                              >
                                Visit Website
                                <ExternalLink className="h-3 w-3 ml-1" />
                              </a>
                            )}
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}
              </MapContainer>
            </div>
          )}

          <div className="mt-4 text-xs text-muted-foreground">
            <p>
              💡 Tip: The map is centered on Europe by default. Use mouse wheel to zoom and drag to pan.
              Click on markers to view company details.
            </p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
