import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'

const IDEA_VALIDATOR_STORAGE_KEY = 'idea-validator-last-idea'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Alert, AlertDescription } from './ui/alert'
import { Lightbulb, Search, CheckCircle, AlertCircle, XCircle, TrendingUp, Users } from 'lucide-react'
import { apiClient } from '../lib/api'
import type { ValidationResult, SimilarCompany } from '../lib/api'
import { ValidatorCompanyCard } from './ValidatorCompanyCard'
import { IndustryBreakdownChart } from './IndustryBreakdownChart'
import { BatchTimelineChart } from './BatchTimelineChart'

export function IdeaValidator() {
  const [idea, setIdea] = useState(() => localStorage.getItem(IDEA_VALIDATOR_STORAGE_KEY) ?? '')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ValidationResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleValidate = async () => {
    if (!idea.trim() || idea.trim().length < 10) {
      setError('Please enter at least 10 characters describing your startup idea')
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)

    const trimmedIdea = idea.trim()
    localStorage.setItem(IDEA_VALIDATOR_STORAGE_KEY, trimmedIdea)

    try {
      const response = await apiClient.validateIdea(trimmedIdea)
      setResult(response.data)
    } catch (err: any) {
      console.error('Validation error:', err)
      setError(err.response?.data?.detail || 'Failed to validate idea. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const getIndicatorConfig = (indicator: string) => {
    switch (indicator) {
      case 'green':
        return {
          icon: <CheckCircle className="h-8 w-8 text-green-600" />,
          badgeClass: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
          label: 'Green Light',
          color: 'green'
        }
      case 'yellow':
        return {
          icon: <AlertCircle className="h-8 w-8 text-yellow-600" />,
          badgeClass: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
          label: 'Competitive',
          color: 'yellow'
        }
      case 'crowded':
        return {
          icon: <XCircle className="h-8 w-8 text-red-600" />,
          badgeClass: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
          label: 'Crowded Space',
          color: 'red'
        }
      default:
        return {
          icon: <AlertCircle className="h-8 w-8 text-gray-600" />,
          badgeClass: 'bg-gray-100 text-gray-800',
          label: 'Unknown',
          color: 'gray'
        }
    }
  }

  const charCount = idea.length
  const minChars = 10
  const isValidLength = charCount >= minChars

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center gap-3">
          <Lightbulb className="h-6 w-6 text-[#FB651E]" />
          <div>
            <CardTitle>Validate Your Startup Idea</CardTitle>
            <CardDescription className="font-mono">
              Check if similar companies exist in 5,773 YC startups
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Input Section */}
        <div className="space-y-2">
          <label htmlFor="idea-input" className="text-sm font-medium">
            Describe your startup idea
          </label>
          <textarea
            id="idea-input"
            className="w-full min-h-[120px] p-3 border rounded-md resize-y focus:outline-none focus:ring-2 focus:ring-[#FB651E] focus:border-transparent font-mono text-sm"
            placeholder="E.g., AI-powered code review tool that helps developers write better code by analyzing pull requests and suggesting improvements..."
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            onBlur={() => idea.trim() && localStorage.setItem(IDEA_VALIDATOR_STORAGE_KEY, idea.trim())}
            disabled={loading}
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className={charCount < minChars ? 'text-red-500' : 'text-green-600'}>
              {charCount} / {minChars} characters (minimum)
            </span>
            <span className="font-mono">
              {isValidLength ? '✓ Ready to validate' : '✗ Too short'}
            </span>
          </div>
        </div>

        {/* Example Ideas */}
        <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-md space-y-1">
          <p className="font-semibold">Example ideas to try:</p>
          <ul className="list-disc list-inside space-y-1 font-mono">
            <li>"AI chatbot for customer support"</li>
            <li>"No-code tool for building internal apps"</li>
            <li>"Platform for freelance developers to find remote work"</li>
          </ul>
        </div>

        {/* Validate Button */}
        <Button
          onClick={handleValidate}
          disabled={loading || !isValidLength}
          className="w-full bg-[#FB651E] hover:bg-[#E65C00] text-white font-semibold py-6"
          size="lg"
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2" />
              Analyzing idea...
            </>
          ) : (
            <>
              <Search className="mr-2 h-5 w-5" />
              Validate Idea
            </>
          )}
        </Button>

        {/* Error State */}
        {error && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Results Section */}
        {result && (
          <div className="space-y-6 mt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Market Indicator */}
            <Card className="border-2">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div>{getIndicatorConfig(result.market_indicator).icon}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className={getIndicatorConfig(result.market_indicator).badgeClass}>
                        {getIndicatorConfig(result.market_indicator).label}
                      </Badge>
                      <span className="text-sm text-muted-foreground font-mono">
                        {result.total_similar} similar {result.total_similar === 1 ? 'company' : 'companies'} found
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed">{result.market_analysis}</p>
                    <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground font-mono">
                      <span className="flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" />
                        {result.market_size_percentage}% of YC portfolio
                      </span>
                      {result.industry_breakdown && Object.keys(result.industry_breakdown).length > 0 && (
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {Object.keys(result.industry_breakdown).length}{' '}
                          {Object.keys(result.industry_breakdown).length === 1 ? 'industry' : 'industries'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* No Results State */}
            {result.total_similar === 0 && (
              <Card className="border-2 border-green-200 bg-green-50/50 dark:bg-green-900/10">
                <CardContent className="pt-6">
                  <div className="text-center space-y-3">
                    <Lightbulb className="h-12 w-12 text-green-600 mx-auto" />
                    <h3 className="text-lg font-semibold text-green-900 dark:text-green-400">
                      Congratulations! 🎉
                    </h3>
                    <p className="text-sm text-green-800 dark:text-green-300">
                      No similar companies found in the YC portfolio. You might have first-mover advantage!
                    </p>
                    <p className="text-xs text-green-700 dark:text-green-400 italic">
                      Note: This doesn't mean the idea is unique globally. Always validate with potential
                      customers and research the broader market.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Charts Section (only if we have results) */}
            {result.total_similar > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Industry Breakdown */}
                {result.industry_breakdown && Object.keys(result.industry_breakdown).length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Industry Breakdown</CardTitle>
                      <CardDescription>Companies by industry</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <IndustryBreakdownChart data={result.industry_breakdown} />
                    </CardContent>
                  </Card>
                )}

                {/* Batch Timeline */}
                {result.batch_timeline && result.batch_timeline.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Batch Timeline</CardTitle>
                      <CardDescription>When similar companies were founded</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <BatchTimelineChart data={result.batch_timeline} />
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* Similar Companies Grid */}
            {result.similar_companies && result.similar_companies.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Similar Companies</h3>
                  <span className="text-sm text-muted-foreground font-mono">
                    Sorted by similarity
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {result.similar_companies.map((company: SimilarCompany) => (
                    <ValidatorCompanyCard key={company.id} company={company} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
