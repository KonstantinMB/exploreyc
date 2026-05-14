import { useState } from 'react'
import { Card, CardContent } from './ui/card'
import { Badge } from './ui/badge'
import { ExternalLink, MapPin, Users, Briefcase } from 'lucide-react'
import type { SimilarCompany } from '../lib/api'
import { CompanyDetailModal } from './CompanyDetailModal'

interface ValidatorCompanyCardProps {
  company: SimilarCompany
}

export function ValidatorCompanyCard({ company }: ValidatorCompanyCardProps) {
  const [showModal, setShowModal] = useState(false)

  // Get similarity score percentage
  const similarityPercent = Math.round((company.similarity_score || 0) * 100)

  // Get similarity badge color based on score
  const getSimilarityBadgeClass = (score: number) => {
    if (score >= 0.8) return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
    if (score >= 0.6) return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400'
    return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
  }

  return (
    <>
      <Card
        className="group cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02] border-l-4 border-l-[#FB651E]"
        onClick={() => setShowModal(true)}
      >
        <CardContent className="p-4 space-y-3">
          {/* Header with Logo and Similarity */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {/* Logo */}
              {company.small_logo_thumb_url ? (
                <img
                  src={company.small_logo_thumb_url}
                  alt={`${company.name} logo`}
                  className="w-10 h-10 rounded-md object-cover flex-shrink-0 bg-gray-100"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                  }}
                />
              ) : (
                <div className="w-10 h-10 rounded-md bg-[#FB651E]/10 flex items-center justify-center flex-shrink-0">
                  <Briefcase className="h-5 w-5 text-[#FB651E]" />
                </div>
              )}

              {/* Company Name */}
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-base truncate group-hover:text-[#FB651E] transition-colors">
                  {company.name}
                </h3>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge variant="outline" className="text-xs font-mono">
                    {company.batch}
                  </Badge>
                  {company.is_hiring && (
                    <Badge className="text-xs bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                      Hiring
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Similarity Score */}
            <Badge className={`${getSimilarityBadgeClass(company.similarity_score)} font-mono text-xs`}>
              {similarityPercent}% match
            </Badge>
          </div>

          {/* One Liner */}
          <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
            {company.one_liner || 'No description available'}
          </p>

          {/* Metadata */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground font-mono">
            {company.industry && (
              <span className="flex items-center gap-1 truncate">
                <Briefcase className="h-3 w-3 flex-shrink-0" />
                {company.industry}
              </span>
            )}
            {company.team_size && (
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3 flex-shrink-0" />
                {company.team_size}
              </span>
            )}
            {company.country && (
              <span className="flex items-center gap-1 truncate">
                <MapPin className="h-3 w-3 flex-shrink-0" />
                {company.country}
              </span>
            )}
          </div>

          {/* Footer Actions */}
          <div className="pt-2 border-t flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-mono">
              Click for details
            </span>
            {company.website && (
              <a
                href={company.website}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-xs text-[#FB651E] hover:underline flex items-center gap-1 font-mono"
              >
                Visit site
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Company Detail Modal */}
      {showModal && (
        <CompanyDetailModal
          company={company}
          open={showModal}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  )
}
