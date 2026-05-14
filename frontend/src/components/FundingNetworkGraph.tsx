import { useCallback, useMemo, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import ReactFlow, {
  type Node,
  type Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  ConnectionLineType,
  type NodeTypes,
  Panel,
  type OnMove,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { DotPattern } from './ui/dot-pattern';
import { GridPattern } from './ui/grid-pattern';

interface CompanyNode {
  id: number;
  name: string;
  slug: string;
  funding_total_usd: number;
  valuation_usd?: number;
  funding_stage?: string;
  batch: string;
  industry: string;
  logo?: string;
  last_funding_date?: string;
  employee_count?: number;
}

interface InvestorNode {
  id: number;
  name: string;
  investor_type?: string;
  portfolio_count: number;
}

interface FundingConnection {
  company_id: number;
  investor_id: number;
  amount_usd?: number;
  round_name?: string;
  date?: string;
}

interface FundingNetworkGraphProps {
  companies: CompanyNode[];
  investors: InvestorNode[];
  connections: FundingConnection[];
  onCompanyClick?: (company: CompanyNode) => void;
  onInvestorClick?: (investor: InvestorNode) => void;
  filterDate?: string;
  layout?: 'force' | 'hierarchical' | 'circular';
}

// Custom Company Node Component
function CompanyNodeComponent({ data }: { data: any }) {
  const getFundingStageColor = (stage?: string) => {
    if (!stage) return '#94a3b8'; // gray
    const stageLower = stage.toLowerCase();
    if (stageLower.includes('seed')) return '#FB651E'; // orange
    if (stageLower.includes('series a') || stageLower.includes('series b')) return '#10b981'; // emerald
    if (stageLower.includes('series c') || stageLower.includes('series d')) return '#3b82f6'; // blue
    return '#8b5cf6'; // violet for late stage
  };

  const getNodeSize = (funding: number) => {
    if (funding >= 1000000000) return 80; // $1B+ (unicorn)
    if (funding >= 100000000) return 60; // $100M+
    if (funding >= 10000000) return 45; // $10M+
    return 35; // < $10M
  };

  const size = getNodeSize(data.funding_total_usd);
  const color = getFundingStageColor(data.funding_stage);
  const isUnicorn = data.valuation_usd && data.valuation_usd >= 1000000000;

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileHover={{ scale: 1.1 }}
      transition={{ duration: 0.3 }}
      className="relative cursor-pointer"
      style={{ width: size, height: size }}
    >
      {/* Unicorn glow effect */}
      {isUnicorn && (
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{
            background: `radial-gradient(circle, ${color}40 0%, transparent 70%)`,
            filter: 'blur(8px)',
          }}
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.5, 0.8, 0.5],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      )}

      {/* Node circle */}
      <div
        className="relative w-full h-full rounded-full border-2 backdrop-blur-sm flex items-center justify-center"
        style={{
          backgroundColor: `${color}15`,
          borderColor: color,
          boxShadow: isUnicorn ? `0 0 20px ${color}60` : `0 0 10px ${color}40`,
        }}
      >
        {/* Company logo or initial */}
        {data.logo ? (
          <img
            src={data.logo}
            alt={data.name}
            className="w-3/4 h-3/4 rounded-full object-cover"
          />
        ) : (
          <span
            className="font-bold font-mono"
            style={{
              color,
              fontSize: size / 3.5,
            }}
          >
            {data.name.charAt(0)}
          </span>
        )}
      </div>

      {/* Company name label (always visible) */}
      <div
        className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap pointer-events-none"
        style={{ width: 'max-content' }}
      >
        <div className="text-[10px] font-mono font-semibold text-foreground bg-background/90 backdrop-blur-sm px-2 py-0.5 rounded border border-border/50 shadow-sm">
          {data.name}
        </div>
      </div>

      {/* Funding amount label */}
      {data.funding_total_usd > 0 && (
        <div
          className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap pointer-events-none"
          style={{ width: 'max-content' }}
        >
          <div className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: `${color}20`, color }}>
            {data.funding_total_usd >= 1000000000
              ? `$${(data.funding_total_usd / 1000000000).toFixed(1)}B`
              : data.funding_total_usd >= 1000000
              ? `$${(data.funding_total_usd / 1000000).toFixed(0)}M`
              : `$${(data.funding_total_usd / 1000).toFixed(0)}K`}
          </div>
        </div>
      )}

      {/* Corner brackets for selected/focused nodes */}
      {data.selected && (
        <>
          <div className="absolute -top-1 -left-1 w-3 h-3 border-t-2 border-l-2" style={{ borderColor: color }} />
          <div className="absolute -top-1 -right-1 w-3 h-3 border-t-2 border-r-2" style={{ borderColor: color }} />
          <div className="absolute -bottom-1 -left-1 w-3 h-3 border-b-2 border-l-2" style={{ borderColor: color }} />
          <div className="absolute -bottom-1 -right-1 w-3 h-3 border-b-2 border-r-2" style={{ borderColor: color }} />
        </>
      )}
    </motion.div>
  );
}

// Sector label as a React Flow node (sticks with graph on zoom/pan)
function SectorLabelNode({ data }: { data: { label: string } }) {
  return (
    <div className="pointer-events-none select-none">
      <div className="bg-primary/10 backdrop-blur-sm border-2 border-primary/30 rounded-lg px-4 py-2 shadow-lg whitespace-nowrap">
        <div className="text-sm font-bold font-mono text-primary uppercase tracking-wide">
          {data.label}
        </div>
      </div>
    </div>
  );
}

// Custom Investor Node Component
function InvestorNodeComponent({ data }: { data: any }) {
  const size = 40 + Math.min(data.portfolio_count * 2, 40); // Size based on portfolio

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileHover={{ scale: 1.1 }}
      transition={{ duration: 0.3 }}
      className="relative cursor-pointer"
    >
      {/* Investor square node */}
      <div
        className="relative backdrop-blur-sm border-2 border-blue-500 flex items-center justify-center font-mono text-xs font-bold"
        style={{
          width: size,
          height: size,
          backgroundColor: '#3b82f615',
          boxShadow: '0 0 10px #3b82f640',
          transform: 'rotate(45deg)',
        }}
      >
        <span
          className="text-blue-500"
          style={{
            transform: 'rotate(-45deg)',
            fontSize: size / 3,
          }}
        >
          {data.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2)}
        </span>
      </div>
    </motion.div>
  );
}

export function FundingNetworkGraph({
  companies,
  investors,
  connections,
  onCompanyClick,
  onInvestorClick,
  filterDate,
  layout: _layout = 'force',
}: FundingNetworkGraphProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  // Define custom node types
  const nodeTypes: NodeTypes = useMemo(
    () => ({
      company: CompanyNodeComponent,
      investor: InvestorNodeComponent,
      sector: SectorLabelNode,
    }),
    []
  );

  // Calculate node positions using force-directed layout with dynamic spacing
  const calculateForceLayout = useCallback((
    companyNodes: CompanyNode[],
    investorNodes: InvestorNode[],
    _connectionEdges: FundingConnection[],
    spacingMultiplier: number = 1
  ) => {
    // Increased base canvas size for more spread (2x larger)
    const baseWidth = 2800;
    const baseHeight = 1800;

    // Apply spacing multiplier to effective canvas size
    const width = baseWidth * spacingMultiplier;
    const height = baseHeight * spacingMultiplier;

    // Simple force-directed layout simulation
    const positions = new Map<string, { x: number; y: number }>();
    const clusters: Array<{industry: string, x: number, y: number}> = [];

    // Group companies by industry into visible clusters (fallback for empty)
    const industries = Array.from(new Set(companyNodes.map(c => c.industry || 'Other')));

    // Calculate grid layout for industry clusters with more spacing
    const cols = Math.ceil(Math.sqrt(industries.length));
    const rows = Math.ceil(industries.length / cols);
    const clusterWidth = width / cols;
    const clusterHeight = height / rows;

    industries.forEach((industry, idx) => {
      const industryCompanies = companyNodes.filter(c => (c.industry || 'Other') === industry);

      // Calculate cluster center position
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const centerX = col * clusterWidth + clusterWidth / 2;
      const centerY = row * clusterHeight + clusterHeight / 2;

      // Store cluster position for labels
      clusters.push({ industry, x: centerX, y: centerY - clusterHeight * 0.35 });

      // Position companies within the cluster with MUCH more spread
      industryCompanies.forEach((company, companyIdx) => {
        // Increased radius for more spread (was 0.3, now 0.45)
        const radius = Math.min(clusterWidth, clusterHeight) * 0.45;
        const angle = (2 * Math.PI * companyIdx) / industryCompanies.length;
        // Increased distance variation (was 0.4-1.0, now 0.5-1.2 for more spread)
        const distance = radius * (0.5 + Math.random() * 0.7);

        const x = centerX + distance * Math.cos(angle);
        const y = centerY + distance * Math.sin(angle);
        positions.set(`company-${company.id}`, { x, y });
      });
    });

    // Place investors scattered with more spacing
    investorNodes.forEach((investor, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      // Increased investor spacing (was 100, now 200)
      const x = col * clusterWidth + clusterWidth / 2 + (Math.random() - 0.5) * 200 * spacingMultiplier;
      const y = row * clusterHeight + clusterHeight / 2 + (Math.random() - 0.5) * 200 * spacingMultiplier;
      positions.set(`investor-${investor.id}`, { x, y });
    });

    return { positions, clusters };
  }, []);

  // Parse batch to Date (handles "Winter 2024" and "W24"/"S24")
  const parseBatchDate = useCallback((batch: string): Date | null => {
    if (!batch) return null;
    // Full format: "Winter 2024", "Summer 2023"
    const fullMatch = batch.match(/(Winter|Summer|Spring|Fall)\s+(\d{4})/);
    if (fullMatch) {
      const [, season, year] = fullMatch;
      const month = season === 'Winter' ? 1 : season === 'Summer' ? 6 : season === 'Spring' ? 3 : 9;
      return new Date(parseInt(year), month - 1, 1);
    }
    // Short format: "W24", "S23"
    const shortMatch = batch.match(/^([WS])(\d{2})$/i);
    if (shortMatch) {
      const [, seasonCode, yearSuffix] = shortMatch;
      const year = 2000 + parseInt(yearSuffix, 10);
      const month = seasonCode.toUpperCase() === 'W' ? 1 : 6;
      return new Date(year, month - 1, 1);
    }
    return null;
  }, []);

  // Filter data based on timeline date
  const filteredData = useMemo(() => {
    if (!filterDate || filterDate === 'Present') {
      return { companies, investors, connections };
    }

    const filterBatchDate = parseBatchDate(filterDate);
    if (!filterBatchDate) {
      return { companies, investors, connections };
    }

    // Filter companies by batch date (only show companies from batches before or equal to filterDate)
    const filteredCompanies = companies.filter(company => {
      const companyDate = parseBatchDate(company.batch);
      return companyDate && companyDate <= filterBatchDate;
    });

    // Filter connections to only include filtered companies
    const filteredCompanyIds = new Set(filteredCompanies.map(c => c.id));
    const filteredConnections = connections.filter(conn =>
      filteredCompanyIds.has(conn.company_id)
    );

    // Filter investors to only those with remaining connections
    const filteredInvestorIds = new Set(filteredConnections.map(c => c.investor_id));
    const filteredInvestors = investors.filter(inv =>
      filteredInvestorIds.has(inv.id)
    );

    return {
      companies: filteredCompanies,
      investors: filteredInvestors,
      connections: filteredConnections,
    };
  }, [companies, investors, connections, filterDate, parseBatchDate]);

  // Track zoom level changes to dynamically adjust spacing
  const handleMove: OnMove = useCallback((_event, viewport) => {
    // Round to 1 decimal place to avoid excessive recalculations
    const roundedZoom = Math.round(viewport.zoom * 10) / 10;
    setZoomLevel(roundedZoom);
  }, []);

  // Calculate spacing multiplier based on zoom level
  // When zoomed in (zoom > 1), increase spacing proportionally
  const spacingMultiplier = useMemo(() => {
    if (zoomLevel <= 1) return 1;
    // Increase spacing by 50% for each zoom level
    // e.g., zoom 1.5 = 1.75x spacing, zoom 2.0 = 2.5x spacing
    return 1 + (zoomLevel - 1) * 1.5;
  }, [zoomLevel]);

  // Initialize nodes and edges
  useEffect(() => {
    if (!filteredData.companies || filteredData.companies.length === 0) return;

    const { positions, clusters } = calculateForceLayout(
      filteredData.companies,
      filteredData.investors,
      filteredData.connections,
      spacingMultiplier
    );

    // Create sector label nodes (inside React Flow so they stick on zoom/pan)
    const sectorNodes: Node[] = clusters.map((cluster, idx) => ({
      id: `sector-${idx}-${cluster.industry}`,
      type: 'sector',
      position: { x: cluster.x - 60, y: cluster.y - 16 },
      data: { label: cluster.industry },
      draggable: false,
      selectable: false,
      deletable: false,
    }));

    // Create company nodes
    const companyNodes: Node[] = filteredData.companies.map(company => ({
      id: `company-${company.id}`,
      type: 'company',
      position: positions.get(`company-${company.id}`) || { x: 0, y: 0 },
      data: {
        ...company,
        selected: selectedNode === `company-${company.id}`,
      },
    }));

    // Create investor nodes
    const investorNodes: Node[] = filteredData.investors.map(investor => ({
      id: `investor-${investor.id}`,
      type: 'investor',
      position: positions.get(`investor-${investor.id}`) || { x: 0, y: 0 },
      data: {
        ...investor,
        selected: selectedNode === `investor-${investor.id}`,
      },
    }));

    // Create edges (connections) - more visible
    const connectionEdges: Edge[] = filteredData.connections.map((conn, idx) => ({
      id: `edge-${idx}`,
      source: `investor-${conn.investor_id}`,
      target: `company-${conn.company_id}`,
      type: 'default',
      animated: false,
      style: {
        stroke: '#10b98160',
        strokeWidth: conn.amount_usd ? Math.min(2 + Math.log10(conn.amount_usd / 1000000), 6) : 1.5,
      },
      label: conn.amount_usd && conn.amount_usd >= 10000000
        ? `$${(conn.amount_usd / 1000000).toFixed(0)}M`
        : undefined,
      labelStyle: {
        fontSize: 8,
        fill: '#10b981',
        fontWeight: 600,
        fontFamily: 'monospace',
      },
      labelBgStyle: {
        fill: 'hsl(var(--background))',
        fillOpacity: 0.9,
      },
    }));

    setNodes([...sectorNodes, ...companyNodes, ...investorNodes]);
    setEdges(connectionEdges);
  }, [filteredData, selectedNode, spacingMultiplier, calculateForceLayout, setNodes, setEdges]);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      setSelectedNode(node.id);

      if (node.type === 'company' && onCompanyClick) {
        const company = companies.find(c => `company-${c.id}` === node.id);
        if (company) onCompanyClick(company);
      } else if (node.type === 'investor' && onInvestorClick) {
        const investor = investors.find(i => `investor-${i.id}` === node.id);
        if (investor) onInvestorClick(investor);
      }
    },
    [companies, investors, onCompanyClick, onInvestorClick]
  );

  return (
    <div className="relative w-full h-full bg-background overflow-hidden">
      {/* Background patterns */}
      <DotPattern color="hsl(var(--primary) / 0.1)" size={24} radius={0.5} />
      <GridPattern size={32} className="opacity-30" />

      {/* React Flow */}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onMove={handleMove}
        nodeTypes={nodeTypes}
        connectionLineType={ConnectionLineType.Bezier}
        fitView
        minZoom={0.1}
        maxZoom={2}
        className="relative z-10"
      >
        <Background color="hsl(var(--muted) / 0.3)" gap={16} />
        <Controls className="bg-card border border-border rounded-lg" />

        {/* Info Panel - Funding stage colors */}
        <Panel position="top-left" className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-lg p-3 font-mono text-xs">
          <div className="text-muted-foreground/80 mb-2 text-[10px] uppercase tracking-wide">Funding stage</div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#FB651E]" />
              <span className="text-muted-foreground">Seed</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
              <span className="text-muted-foreground">Series A-B</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <span className="text-muted-foreground">Series C-D</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-violet-500" />
              <span className="text-muted-foreground">Late Stage</span>
            </div>
          </div>
        </Panel>

        {/* Stats Panel - shows filtered counts when timeline is active */}
        <Panel position="top-right" className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-lg p-3 font-mono text-xs">
          <div className="space-y-1">
            <div className="text-muted-foreground">
              companies: <span className="text-emerald-500 font-bold">{filteredData.companies.length}</span>
              {filterDate && filteredData.companies.length !== companies.length && (
                <span className="text-muted-foreground/70"> / {companies.length}</span>
              )}
            </div>
            <div className="text-muted-foreground">
              investors: <span className="text-blue-500 font-bold">{filteredData.investors.length}</span>
              {filterDate && filteredData.investors.length !== investors.length && (
                <span className="text-muted-foreground/70"> / {investors.length}</span>
              )}
            </div>
            <div className="text-muted-foreground">
              connections: <span className="text-violet-500 font-bold">{filteredData.connections.length}</span>
              {filterDate && filteredData.connections.length !== connections.length && (
                <span className="text-muted-foreground/70"> / {connections.length}</span>
              )}
            </div>
          </div>
        </Panel>

        {/* Data Notice Panel */}
        <Panel position="bottom-right" className="bg-amber-500/10 backdrop-blur-sm border border-amber-500/30 rounded-lg p-3 font-mono text-xs max-w-xs">
          <div className="flex items-start gap-2">
            <span className="text-amber-500 font-bold">ℹ</span>
            <div className="space-y-1">
              <div className="text-amber-600 dark:text-amber-400 font-semibold">Optimized View</div>
              <div className="text-muted-foreground">
                Defaulting to 2020+ companies for faster load times. Use year filter to view older batches.
              </div>
            </div>
          </div>
        </Panel>
      </ReactFlow>

      {/* Terminal prompt overlay */}
      <div className="absolute bottom-4 left-4 font-mono text-xs text-muted-foreground pointer-events-none z-20">
        $ network-graph --interactive --zoom --pan
      </div>
    </div>
  );
}
