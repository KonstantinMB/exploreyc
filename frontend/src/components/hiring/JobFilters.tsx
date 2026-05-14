import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Filter, X } from 'lucide-react';
import type { HiringFilters } from '../../types/hiring';

interface JobFiltersProps {
  filters: HiringFilters;
  onFiltersChange: (filters: HiringFilters) => void;
  stats: {
    roles: Array<{ role: string; count: number }>;
    batches: Array<{ batch: string; count: number }>;
    locations: Array<{ location: string; count: number }>;
  };
  isOpen?: boolean;
  onToggle?: () => void;
}

const JOB_TYPES = [
  { value: 'fulltime', label: 'Full-time' },
  { value: 'contract', label: 'Contract' },
  { value: 'internship', label: 'Internship' },
  { value: 'parttime', label: 'Part-time' },
];

export function JobFilters({ filters, onFiltersChange, stats }: JobFiltersProps) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    roles: true,
    batches: false,
    locations: false,
  });

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const toggleRole = (role: string) => {
    const newRoles = filters.roles.includes(role)
      ? filters.roles.filter(r => r !== role)
      : [...filters.roles, role];
    onFiltersChange({ ...filters, roles: newRoles });
  };

  const toggleBatch = (batch: string) => {
    const newBatches = filters.batches.includes(batch)
      ? filters.batches.filter(b => b !== batch)
      : [...filters.batches, batch];
    onFiltersChange({ ...filters, batches: newBatches });
  };

  const toggleLocation = (location: string) => {
    const newLocations = filters.locations.includes(location)
      ? filters.locations.filter(l => l !== location)
      : [...filters.locations, location];
    onFiltersChange({ ...filters, locations: newLocations });
  };

  const toggleJobType = (jobType: string) => {
    const newJobTypes = filters.jobTypes.includes(jobType)
      ? filters.jobTypes.filter(jt => jt !== jobType)
      : [...filters.jobTypes, jobType];
    onFiltersChange({ ...filters, jobTypes: newJobTypes });
  };

  const clearAllFilters = () => {
    onFiltersChange({
      roles: [],
      batches: [],
      locations: [],
      jobTypes: [],
      experienceLevels: [],
      remote: 'all',
      salaryMin: null,
      salaryMax: null,
      searchQuery: '',
    });
  };

  const activeFilterCount =
    filters.roles.length +
    filters.batches.length +
    filters.locations.length +
    filters.jobTypes.length +
    filters.experienceLevels.length +
    (filters.remote !== 'all' ? 1 : 0);

  return (
    <div className="space-y-4">
      {/* Company Name Search */}
      <div className="space-y-2">
        <label className="text-xs font-mono font-medium text-muted-foreground">Search by Company Name</label>
        <div className="relative">
          <input
            type="text"
            placeholder="e.g., OpenAI, Stripe..."
            value={filters.searchQuery}
            onChange={(e) => onFiltersChange({ ...filters, searchQuery: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:border-[#FB651E] focus:ring-1 focus:ring-[#FB651E] transition-colors"
          />
          {filters.searchQuery && (
            <button
              onClick={() => onFiltersChange({ ...filters, searchQuery: '' })}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between border-t border-border pt-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-[#FB651E]" />
          <h3 className="font-bold font-mono">Filters</h3>
          {activeFilterCount > 0 && (
            <span className="px-2 py-1 bg-[#FB651E]/20 text-[#FB651E] text-xs rounded-full font-mono">
              {activeFilterCount}
            </span>
          )}
        </div>
        {activeFilterCount > 0 && (
          <button
            onClick={clearAllFilters}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors font-mono"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Remote Filter */}
      <div className="space-y-2">
        <div className="text-xs font-mono font-medium text-muted-foreground">Remote</div>
        <div className="grid grid-cols-3 gap-2">
          {[
            { value: 'all', label: 'All' },
            { value: 'yes', label: 'Remote' },
            { value: 'no', label: 'On-site' },
          ].map(option => (
            <button
              key={option.value}
              onClick={() => onFiltersChange({ ...filters, remote: option.value as 'all' | 'yes' | 'no' })}
              className={`px-3 py-2 rounded-lg text-xs font-mono transition-all ${
                filters.remote === option.value
                  ? 'bg-[#FB651E] text-white'
                  : 'bg-muted border border-border hover:border-[#FB651E]/50'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Roles Section */}
      <div className="border-t border-border pt-4">
        <button
          onClick={() => toggleSection('roles')}
          className="w-full flex items-center justify-between text-xs font-mono font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <span>Roles ({filters.roles.length})</span>
          <ChevronDown
            className={`w-4 h-4 transition-transform ${expandedSections.roles ? 'rotate-180' : ''}`}
          />
        </button>
        <AnimatePresence>
          {expandedSections.roles && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3 space-y-2"
            >
              {stats.roles.map(({ role, count }) => (
                <label key={role} className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={filters.roles.includes(role)}
                    onChange={() => toggleRole(role)}
                    className="w-4 h-4 rounded border-border"
                  />
                  <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">
                    {role}
                  </span>
                  <span className="text-xs text-muted-foreground ml-auto">({count})</span>
                </label>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Job Type Section */}
      <div className="border-t border-border pt-4">
        <button
          onClick={() => toggleSection('jobTypes')}
          className="w-full flex items-center justify-between text-xs font-mono font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <span>Job Type ({filters.jobTypes.length})</span>
          <ChevronDown
            className={`w-4 h-4 transition-transform ${expandedSections.roles ? 'rotate-180' : ''}`}
          />
        </button>
        <AnimatePresence>
          {expandedSections.roles && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3 space-y-2"
            >
              {JOB_TYPES.map(({ value, label }) => (
                <label key={value} className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={filters.jobTypes.includes(value)}
                    onChange={() => toggleJobType(value)}
                    className="w-4 h-4 rounded border-border"
                  />
                  <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">
                    {label}
                  </span>
                </label>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Batches Section */}
      <div className="border-t border-border pt-4">
        <button
          onClick={() => toggleSection('batches')}
          className="w-full flex items-center justify-between text-xs font-mono font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <span>YC Batch ({filters.batches.length})</span>
          <ChevronDown
            className={`w-4 h-4 transition-transform ${expandedSections.batches ? 'rotate-180' : ''}`}
          />
        </button>
        <AnimatePresence>
          {expandedSections.batches && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3 space-y-2 max-h-48 overflow-y-auto"
            >
              {stats.batches.slice(0, 20).map(({ batch, count }) => (
                <label key={batch} className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={filters.batches.includes(batch)}
                    onChange={() => toggleBatch(batch)}
                    className="w-4 h-4 rounded border-border"
                  />
                  <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">
                    {batch}
                  </span>
                  <span className="text-xs text-muted-foreground ml-auto">({count})</span>
                </label>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Locations Section */}
      <div className="border-t border-border pt-4">
        <button
          onClick={() => toggleSection('locations')}
          className="w-full flex items-center justify-between text-xs font-mono font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <span>Location ({filters.locations.length})</span>
          <ChevronDown
            className={`w-4 h-4 transition-transform ${expandedSections.locations ? 'rotate-180' : ''}`}
          />
        </button>
        <AnimatePresence>
          {expandedSections.locations && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3 space-y-2 max-h-48 overflow-y-auto"
            >
              {stats.locations.map(({ location, count }) => (
                <label key={location} className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={filters.locations.includes(location)}
                    onChange={() => toggleLocation(location)}
                    className="w-4 h-4 rounded border-border"
                  />
                  <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">
                    {location}
                  </span>
                  <span className="text-xs text-muted-foreground ml-auto">({count})</span>
                </label>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
