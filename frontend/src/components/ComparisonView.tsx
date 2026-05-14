import { motion } from 'framer-motion';
import { GitCompare, X, ExternalLink, MapPin, Users, Building2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { useApp } from '../contexts/AppContext';

export function ComparisonView() {
  const {
    comparisonCompanies: selected,
    setSelectedCompany,
    removeFromComparison,
    clearComparison,
  } = useApp();

  if (selected.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <Card className="border-[#FF6600]/30">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <GitCompare className="h-5 w-5 text-[#FF6600]" />
              Company Comparison
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={clearComparison}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground font-mono">
            Select up to 4 companies to compare side-by-side
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {selected.map((company) => (
              <motion.div
                key={company.id}
                layout
                className="rounded-lg border bg-card p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-2">
                  {company.small_logo_thumb_url && (
                    <img
                      src={company.small_logo_thumb_url}
                      alt={company.name}
                      className="h-10 w-10 rounded"
                    />
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => removeFromComparison(company.id)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
                <h3 className="font-semibold text-sm mb-1 truncate">{company.name}</h3>
                <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                  {company.one_liner}
                </p>
                <div className="space-y-1 text-xs font-mono text-muted-foreground">
                  {company.batch && (
                    <div className="flex items-center gap-1">
                      <Building2 className="h-3 w-3" />
                      {company.batch}
                    </div>
                  )}
                  {company.team_size > 0 && (
                    <div className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {company.team_size} people
                    </div>
                  )}
                  {company.all_locations && (
                    <div className="flex items-center gap-1 truncate">
                      <MapPin className="h-3 w-3 flex-shrink-0" />
                      {company.all_locations}
                    </div>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 w-full text-[#FF6600] border-[#FF6600]/30"
                  onClick={() => setSelectedCompany(company)}
                >
                  View Details
                  <ExternalLink className="h-3 w-3 ml-1" />
                </Button>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
