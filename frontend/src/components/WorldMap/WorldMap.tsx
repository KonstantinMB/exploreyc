import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { FlyToInterpolator } from '@deck.gl/core';
import type { MapViewState } from '@deck.gl/core';
import { Card, CardContent, CardHeader } from '../ui/card';
import { Button } from '../ui/button';
import { useApp } from '../../contexts/AppContext';
import { Info, X, Play, Pause, Globe2, Map as MapIcon, Plane } from 'lucide-react';
import type { Company } from '../../lib/api';
import { DeckMap } from './DeckMap';
import { batchSortKey, sortBatchesChronologically } from './batchOrder';
import { computeHubs } from './hubs';

type ViewStateWithTransition = MapViewState & {
  transitionDuration?: number | 'auto';
  transitionInterpolator?: unknown;
};

const INITIAL_VIEW: MapViewState = {
  longitude: 0,
  latitude: 20,
  zoom: 1.6,
  pitch: 30,
  bearing: 0,
};

const REGIONS = [
  { name: '🇺🇸 US', latitude: 37.09, longitude: -95.71, zoom: 3.6 },
  { name: '🇪🇺 Europe', latitude: 50.0, longitude: 10.0, zoom: 3.6 },
  { name: '🌏 Asia', latitude: 25.0, longitude: 95.0, zoom: 3 },
  { name: '🌍 World', latitude: 20.0, longitude: 0.0, zoom: 1.6 },
];

const PULSE_FPS = 24;
const TIMELINE_STEP_MS = 700;
const TOUR_STEP_MS = 4000;

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

export function WorldMap() {
  const {
    companies,
    totalMapCompanies,
    loadAllMapCompanies,
    setSelectedCompany,
    darkMode,
  } = useApp();

  const reducedMotion = usePrefersReducedMotion();

  const [viewState, setViewState] = useState<ViewStateWithTransition>(INITIAL_VIEW);
  const [is3D, setIs3D] = useState(false);
  const [interacted, setInteracted] = useState(false);
  const [showAllBatches, setShowAllBatches] = useState(false);
  const [showBanner, setShowBanner] = useState(true);
  const [loadingAll, setLoadingAll] = useState(false);
  const [loadAllFailed, setLoadAllFailed] = useState(false);

  // Timeline
  const [timelineIdx, setTimelineIdx] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);

  // Tour
  const [tourIdx, setTourIdx] = useState<number | null>(null);

  // Pulse clock (seconds). Stays 0 under reduced motion → rings never render.
  const [pulseTime, setPulseTime] = useState(0);

  // Half of YC is literally "San Francisco, CA, USA" — identical centroid coords
  // stack into one blob. Deterministic per-id jitter (~2km disk) spreads them
  // stably across renders; invisible at world zoom, constellation at city zoom.
  const geoCompanies = useMemo(
    () =>
      companies
        .filter((c) => c.latitude != null && c.longitude != null)
        .map((c) => {
          const h = (c.id * 2654435761) >>> 0;
          const angle = ((h % 3600) / 3600) * 2 * Math.PI;
          const dist = Math.sqrt(((h >>> 12) % 1000) / 1000);
          const r = 0.02 * dist;
          const latRad = (c.latitude! * Math.PI) / 180;
          return {
            ...c,
            latitude: c.latitude! + r * Math.cos(angle),
            longitude: c.longitude! + (r * Math.sin(angle)) / Math.max(Math.cos(latRad), 0.2),
          };
        }),
    [companies]
  );

  const allBatchesSorted = useMemo(
    () =>
      sortBatchesChronologically(
        Array.from(new Set(geoCompanies.map((c) => c.batch).filter(Boolean)))
      ),
    [geoCompanies]
  );

  const last4Batches = useMemo(
    () => new Set(allBatchesSorted.slice(-4)),
    [allBatchesSorted]
  );

  // Base set: recent batches by default, everything when expanded or during timeline.
  const baseCompanies = useMemo(() => {
    if (showAllBatches || timelineIdx !== null) return geoCompanies;
    return geoCompanies.filter((c) => last4Batches.has(c.batch || ''));
  }, [geoCompanies, showAllBatches, timelineIdx, last4Batches]);

  // Timeline filter: cumulative up to the selected batch.
  const mapCompanies = useMemo(() => {
    if (timelineIdx === null) return baseCompanies;
    const currentBatch = allBatchesSorted[Math.min(timelineIdx, allBatchesSorted.length - 1)];
    const threshold = batchSortKey(currentBatch);
    return baseCompanies.filter((c) => batchSortKey(c.batch || '') <= threshold);
  }, [baseCompanies, timelineIdx, allBatchesSorted]);

  const hubs = useMemo(() => computeHubs(geoCompanies), [geoCompanies]);

  const ensureAllLoaded = useCallback(async () => {
    if (totalMapCompanies > companies.length) {
      setLoadingAll(true);
      setLoadAllFailed(false);
      try {
        await loadAllMapCompanies();
      } catch {
        setLoadAllFailed(true);
      } finally {
        setLoadingAll(false);
      }
    }
  }, [totalMapCompanies, companies.length, loadAllMapCompanies]);

  // --- Animation clock: pulse + globe auto-rotate in one rAF loop ---
  const interactedRef = useRef(interacted);
  interactedRef.current = interacted;
  const tourActiveRef = useRef(tourIdx !== null);
  tourActiveRef.current = tourIdx !== null;

  useEffect(() => {
    if (reducedMotion) {
      setPulseTime(0);
      return;
    }
    let raf = 0;
    let last = 0;
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      if (t - last < 1000 / PULSE_FPS) return;
      last = t;
      setPulseTime(t / 1000);
      if (is3D && !interactedRef.current && !tourActiveRef.current) {
        setViewState((vs) => ({
          ...vs,
          longitude: ((vs.longitude + 0.06 + 180) % 360) - 180,
          transitionDuration: 0,
        }));
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [reducedMotion, is3D]);

  // --- Timeline playback ---
  useEffect(() => {
    if (!playing || timelineIdx === null) return;
    const interval = setInterval(() => {
      setTimelineIdx((idx) => {
        if (idx === null || idx >= allBatchesSorted.length - 1) {
          setPlaying(false);
          return idx;
        }
        return idx + 1;
      });
    }, TIMELINE_STEP_MS);
    return () => clearInterval(interval);
  }, [playing, timelineIdx !== null, allBatchesSorted.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const startTimeline = async () => {
    setTourIdx(null);
    await ensureAllLoaded();
    setTimelineIdx(0);
    setPlaying(true);
  };

  const closeTimeline = () => {
    setPlaying(false);
    setTimelineIdx(null);
  };

  // --- Tour ---
  const flyTo = useCallback(
    (latitude: number, longitude: number, zoom: number) => {
      setViewState((vs) => ({
        ...vs,
        latitude,
        longitude,
        zoom,
        transitionDuration: is3D ? 1200 : 2200,
        transitionInterpolator: is3D ? undefined : new FlyToInterpolator({ speed: 0.9 }),
      }));
    },
    [is3D]
  );

  useEffect(() => {
    if (tourIdx === null || hubs.length === 0) return;
    const hub = hubs[tourIdx % hubs.length];
    flyTo(hub.latitude, hub.longitude, is3D ? 3 : 8.5);
    const interval = setInterval(() => {
      setTourIdx((idx) => (idx === null ? null : (idx + 1) % hubs.length));
    }, TOUR_STEP_MS);
    return () => clearInterval(interval);
  }, [tourIdx, hubs, flyTo, is3D]);

  const startTour = () => {
    closeTimeline();
    setInteracted(false);
    setTourIdx(0);
  };

  const endTour = () => setTourIdx(null);

  const handleUserInteraction = useCallback(() => {
    setInteracted(true);
    setTourIdx((idx) => (idx !== null ? null : idx));
  }, []);

  const toggle3D = () => {
    setIs3D((prev) => {
      const next = !prev;
      setViewState((vs) => ({
        longitude: vs.longitude,
        latitude: next ? Math.max(-60, Math.min(60, vs.latitude)) : vs.latitude,
        // Globe always enters framed as a full sphere; 2D re-enters at a sane
        // world zoom (GlobeView and MapView zoom scales differ).
        zoom: next ? 0.8 : Math.max(vs.zoom, 1.5),
        pitch: next ? 0 : 30,
        bearing: 0,
        transitionDuration: 0,
      }));
      return next;
    });
    setInteracted(false);
  };

  // Stats
  const europeanCount = useMemo(
    () =>
      mapCompanies.filter(
        (c) => c.latitude! > 35 && c.latitude! < 71 && c.longitude! > -10 && c.longitude! < 40
      ).length,
    [mapCompanies]
  );
  const usCount = useMemo(
    () =>
      mapCompanies.filter(
        (c) => c.latitude! > 24 && c.latitude! < 50 && c.longitude! > -125 && c.longitude! < -65
      ).length,
    [mapCompanies]
  );

  const currentBatchLabel =
    timelineIdx !== null && allBatchesSorted.length > 0
      ? allBatchesSorted[Math.min(timelineIdx, allBatchesSorted.length - 1)]
      : null;

  const currentHub = tourIdx !== null && hubs.length > 0 ? hubs[tourIdx % hubs.length] : null;

  const handleCompanyClick = useCallback(
    (c: Company) => setSelectedCompany(c),
    [setSelectedCompany]
  );

  const handleViewStateChange = useCallback((vs: MapViewState) => {
    setViewState(vs);
  }, []);

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
                {mapCompanies.length.toLocaleString()} companies • {europeanCount} in Europe •{' '}
                {usCount} in US
              </p>
            </div>

            <div className="flex items-center gap-1 sm:gap-2 text-xs flex-wrap flex-shrink-0">
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

          {/* Info banner: recent batches by default */}
          {showBanner && !showAllBatches && timelineIdx === null && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
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
                    <span className="font-semibold">
                      {Array.from(last4Batches).join(', ')}
                    </span>
                  </p>
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-[#FB651E] hover:text-[#FB651E]/80 font-mono text-xs mt-2 disabled:opacity-50"
                    disabled={loadingAll}
                    onClick={async () => {
                      setShowAllBatches(true);
                      await ensureAllLoaded();
                    }}
                  >
                    {loadingAll
                      ? 'Loading…'
                      : `Show all ${totalMapCompanies.toLocaleString()} companies →`}
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

          {showAllBatches && timelineIdx === null && (
            <div className="mt-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">
                  Showing all {mapCompanies.length.toLocaleString()} companies
                </p>
                <Button variant="outline" size="sm" onClick={() => setShowAllBatches(false)}>
                  Show recent batches only
                </Button>
              </div>
            </div>
          )}

          {/* Timeline bar */}
          {timelineIdx !== null && (
            <div className="mt-4 bg-[#FB651E]/10 border border-[#FB651E]/30 rounded-lg p-3">
              <div className="flex items-center gap-3">
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-8 w-8 p-0 flex-shrink-0"
                  onClick={() => {
                    if (!playing && timelineIdx >= allBatchesSorted.length - 1) {
                      setTimelineIdx(0);
                    }
                    setPlaying(!playing);
                  }}
                >
                  {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </Button>
                <input
                  type="range"
                  min={0}
                  max={Math.max(allBatchesSorted.length - 1, 0)}
                  value={Math.min(timelineIdx, allBatchesSorted.length - 1)}
                  onChange={(e) => {
                    setPlaying(false);
                    setTimelineIdx(Number(e.target.value));
                  }}
                  className="flex-1 accent-[#FB651E] min-w-0"
                />
                <div className="font-mono text-xs sm:text-sm whitespace-nowrap flex-shrink-0">
                  <span className="font-bold text-[#FB651E]">{currentBatchLabel}</span>
                  <span className="text-muted-foreground">
                    {' '}— {mapCompanies.length.toLocaleString()} companies
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 flex-shrink-0"
                  onClick={closeTimeline}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              {loadAllFailed && (
                <p className="text-xs text-muted-foreground mt-2 font-mono">
                  Couldn't load every batch — playing the ones already loaded.
                </p>
              )}
            </div>
          )}
        </CardHeader>

        <CardContent className="p-0">
          <div className="h-[350px] sm:h-[500px] md:h-[600px] lg:h-[700px] min-h-[300px] relative rounded-b-lg overflow-hidden border-t"
            style={{
              // 3D globe floats in dark space; 2D falls back to the basemap water
              // color so any sub-pixel edge blends (the view is clamped to fill).
              background: is3D ? '#04070e' : darkMode ? '#0b0e13' : '#d4d8db',
            }}
          >
            <DeckMap
              companies={mapCompanies}
              darkMode={darkMode}
              is3D={is3D}
              pulseTime={pulseTime}
              viewState={viewState}
              onViewStateChange={handleViewStateChange}
              onCompanyClick={handleCompanyClick}
              onUserInteraction={handleUserInteraction}
            />

            {/* Controls */}
            <div className="absolute bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:bottom-auto sm:top-4 z-10 flex flex-row sm:flex-col gap-2 flex-wrap justify-center sm:justify-end sm:items-end">
              <Button
                size="sm"
                variant="secondary"
                className="shadow-lg backdrop-blur text-xs sm:text-sm min-h-[36px]"
                onClick={toggle3D}
              >
                {is3D ? (
                  <>
                    <MapIcon className="h-3.5 w-3.5 mr-1" /> 2D Map
                  </>
                ) : (
                  <>
                    <Globe2 className="h-3.5 w-3.5 mr-1" /> 3D Globe
                  </>
                )}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="shadow-lg backdrop-blur text-xs sm:text-sm min-h-[36px]"
                disabled={loadingAll}
                onClick={tourIdx === null ? startTour : endTour}
              >
                <Plane className="h-3.5 w-3.5 mr-1" />
                {tourIdx === null ? 'Tour' : 'End Tour'}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="shadow-lg backdrop-blur text-xs sm:text-sm min-h-[36px]"
                disabled={loadingAll}
                onClick={timelineIdx === null ? startTimeline : closeTimeline}
              >
                {loadingAll ? (
                  'Loading…'
                ) : timelineIdx === null ? (
                  <>
                    <Play className="h-3.5 w-3.5 mr-1" /> Timeline
                  </>
                ) : (
                  'Exit Timeline'
                )}
              </Button>
              {REGIONS.map((region) => (
                <Button
                  key={region.name}
                  size="sm"
                  variant="secondary"
                  className="shadow-lg backdrop-blur text-xs sm:text-sm min-h-[36px]"
                  onClick={() => {
                    endTour();
                    flyTo(region.latitude, region.longitude, region.zoom);
                  }}
                >
                  {region.name}
                </Button>
              ))}
            </div>

            {/* Tour stats card */}
            {currentHub && (
              <motion.div
                key={currentHub.name}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute bottom-4 left-4 z-10 bg-background/90 backdrop-blur border rounded-lg shadow-xl p-4 max-w-[260px] font-mono"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold text-sm">{currentHub.name}</h3>
                  <button
                    onClick={endTour}
                    className="text-muted-foreground hover:text-foreground"
                    aria-label="End tour"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-2 text-xs text-muted-foreground space-y-1">
                  <p>
                    <span className="text-[#FB651E] font-bold">
                      {currentHub.count.toLocaleString()}
                    </span>{' '}
                    companies
                  </p>
                  <p>
                    <span className="text-[#4CAF50] font-bold">{currentHub.hiringCount}</span>{' '}
                    hiring
                  </p>
                  {currentHub.topIndustry !== '—' && (
                    <p>
                      Top industry:{' '}
                      <span className="text-foreground">{currentHub.topIndustry}</span>
                    </p>
                  )}
                </div>
              </motion.div>
            )}
          </div>

          <div className="px-4 sm:px-6 py-3 bg-muted/50 text-xs text-muted-foreground font-mono border-t">
            💡 Click any dot for company details • Zoom out for 3D density bars • Try the Timeline
            and Tour buttons
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default WorldMap;
