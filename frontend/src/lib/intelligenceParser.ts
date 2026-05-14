/**
 * Parser for Perplexity AI intelligence response
 * Converts markdown text into structured data for dashboard display
 */

export interface ParsedIntelligence {
  companyName: string;
  summary: string;
  sections: IntelligenceSection[];
  metrics: MetricData[];
  timeline: TimelineEvent[];
  lastUpdated: string;
}

export interface IntelligenceSection {
  id: string;
  title: string;
  icon: string;
  content: string;
  type: 'news' | 'funding' | 'leadership' | 'product' | 'partnerships' | 'summary';
  items?: string[];
}

export interface MetricData {
  label: string;
  value: string | number;
  type: 'funding' | 'team' | 'valuation' | 'date' | 'other';
  icon?: string;
}

export interface TimelineEvent {
  date: string;
  title: string;
  description: string;
  category: 'funding' | 'hire' | 'partnership' | 'product' | 'news';
}

/**
 * Parse Perplexity response into structured intelligence
 */
export function parseIntelligence(
  companyName: string,
  rawContent: string,
  timestamp: string
): ParsedIntelligence {
  // Extract company name from bold text if available
  const boldMatch = rawContent.match(/\*\*([^*]+)\*\*/);
  const cleanCompanyName = boldMatch ? boldMatch[1].trim() : companyName;

  // Extract summary (first paragraph with better cleaning)
  const summaryMatch = rawContent.match(/^[^#\n]+\n/);
  let summary = summaryMatch ? summaryMatch[0].trim() : '';

  // Clean markdown formatting from summary
  summary = summary
    .replace(/\*\*(.+?)\*\*/g, '$1') // Bold
    .replace(/\*(.+?)\*/g, '$1') // Italic
    .replace(/\[(.+?)\]\(.+?\)/g, '$1') // Links
    .trim();

  // Parse sections
  const sections = parseSections(rawContent);

  // Extract metrics
  const metrics = extractMetrics(rawContent);

  // Extract timeline events
  const timeline = extractTimeline(rawContent);

  return {
    companyName: cleanCompanyName,
    summary,
    sections,
    metrics,
    timeline,
    lastUpdated: timestamp,
  };
}

function parseSections(content: string): IntelligenceSection[] {
  const sections: IntelligenceSection[] = [];
  const lines = content.split('\n');

  let currentSection: Partial<IntelligenceSection> | null = null;
  let currentContent: string[] = [];

  for (const line of lines) {
    // Check for section headers (### or ##)
    const headerMatch = line.match(/^###\s+(.+)$|^##\s+(.+)$/);
    if (headerMatch) {
      // Save previous section
      if (currentSection) {
        currentSection.content = currentContent.join('\n').trim();
        sections.push(currentSection as IntelligenceSection);
      }

      const title = (headerMatch[1] || headerMatch[2]).trim();
      currentSection = {
        id: title.toLowerCase().replace(/[^a-z0-9]/g, '-'),
        title,
        icon: getIconForSection(title),
        type: getTypeForSection(title),
        items: [],
      };
      currentContent = [];
    } else if (currentSection && line.trim()) {
      currentContent.push(line);
    }
  }

  // Save last section
  if (currentSection) {
    currentSection.content = currentContent.join('\n').trim();
    sections.push(currentSection as IntelligenceSection);
  }

  return sections.filter((s) => s.content && s.content.length > 0);
}

function getIconForSection(_title: string): string {
  // Return empty string - icons are handled by component
  return '';
}

function getTypeForSection(title: string): IntelligenceSection['type'] {
  const lower = title.toLowerCase();

  if (lower.includes('news') || lower.includes('announcement')) return 'news';
  if (lower.includes('funding') || lower.includes('round')) return 'funding';
  if (lower.includes('hire') || lower.includes('leadership') || lower.includes('team')) return 'leadership';
  if (lower.includes('product') || lower.includes('market') || lower.includes('strategy')) return 'product';
  if (lower.includes('partnership') || lower.includes('collaboration')) return 'partnerships';

  return 'summary';
}

function extractMetrics(content: string): MetricData[] {
  const metrics: MetricData[] = [];
  const addedMetrics = new Set<string>();

  // Most recent funding (look for patterns like "$X.XM Series A" or "$X.XM round")
  const recentFundingMatch = content.match(/(?:Series\s+[A-Z]|Seed|funding round|raised)[:\s]+(\$?[\d.]+[MBK]?)/i);
  if (recentFundingMatch) {
    const value = recentFundingMatch[1];
    const key = `funding-${value}`;
    if (!addedMetrics.has(key)) {
      metrics.push({
        label: 'Raised',
        value,
        type: 'funding',
      });
      addedMetrics.add(key);
    }
  }

  // Total funding (look for "total capital raised", "$X.XM to date", etc.)
  const totalFundingMatch = content.match(/(?:total.*?raised|total capital|raised to date)[:\s]+(\$?[\d.]+[MBK]?)/i);
  if (totalFundingMatch && !addedMetrics.has(`funding-total`)) {
    const value = totalFundingMatch[1];
    metrics.push({
      label: 'Total Raised',
      value,
      type: 'funding',
    });
    addedMetrics.add(`funding-total`);
  }

  // Valuation
  const valuationMatch = content.match(/(?:valued?\s*at|valuation.*?)[:\s]*(\$?[\d.]+[MBK]?)/i);
  if (valuationMatch && !addedMetrics.has(`valuation`)) {
    const value = valuationMatch[1];
    metrics.push({
      label: 'Valuation',
      value,
      type: 'valuation',
    });
    addedMetrics.add(`valuation`);
  }

  // Team size (employees)
  const teamMatch = content.match(/(\d+(?:,\d{3})*)\s*(?:employees?|team members?|staff|headcount)/i);
  if (teamMatch && !addedMetrics.has(`team`)) {
    metrics.push({
      label: 'Team Size',
      value: teamMatch[1],
      type: 'team',
    });
    addedMetrics.add(`team`);
  }

  // Revenue/ARR
  const revenueMatch = content.match(/(?:revenue|ARR|annual recurring revenue)[:\s]+(\$?[\d.]+[MBK]?)/i);
  if (revenueMatch && !addedMetrics.has(`revenue`)) {
    const value = revenueMatch[1];
    metrics.push({
      label: 'ARR / Revenue',
      value,
      type: 'funding',
    });
    addedMetrics.add(`revenue`);
  }

  // Customer count
  const customerMatch = content.match(/(\d+(?:,\d{3})*)\s*(?:customers?|users|enterprise customers)/i);
  if (customerMatch && !addedMetrics.has(`customers`)) {
    metrics.push({
      label: 'Customers',
      value: customerMatch[1],
      type: 'other',
    });
    addedMetrics.add(`customers`);
  }

  // Market size / TAM
  const tamMatch = content.match(/(?:TAM|total addressable market|market size)[:\s]+(\$?[\d.]+[MBK]?)/i);
  if (tamMatch && !addedMetrics.has(`tam`)) {
    const value = tamMatch[1];
    metrics.push({
      label: 'Market Size',
      value,
      type: 'other',
    });
    addedMetrics.add(`tam`);
  }

  return metrics;
}

function extractTimeline(content: string): TimelineEvent[] {
  const timeline: TimelineEvent[] = [];

  // Match dates and following content
  const dateRegex = /(\d{4}|\w+\s+\d{1,2},?\s+\d{4}|(?:Q[1-4]\s+)?\d{4})/gi;
  const matches = [...content.matchAll(dateRegex)];

  matches.forEach((match, index) => {
    const date = match[0];
    const nextMatch = matches[index + 1];
    const endPos = nextMatch ? nextMatch.index : content.length;

    // Get context around the date
    const startPos = Math.max(0, (match.index || 0) - 100);
    const context = content
      .substring(startPos, endPos)
      .trim()
      .replace(/[#*]/g, '')
      .split('\n')
      .slice(0, 3)
      .join(' ');

    const category = determineEventCategory(context);

    timeline.push({
      date,
      title: extractTitle(context),
      description: context.substring(0, 200),
      category,
    });
  });

  return timeline.slice(0, 10); // Limit to 10 events
}

function determineEventCategory(
  context: string
): TimelineEvent['category'] {
  const lower = context.toLowerCase();

  if (lower.includes('fund') || lower.includes('raise') || lower.includes('series')) return 'funding';
  if (lower.includes('join') || lower.includes('hire') || lower.includes('appoint')) return 'hire';
  if (lower.includes('partner') || lower.includes('announce')) return 'partnership';
  if (lower.includes('launch') || lower.includes('introduce') || lower.includes('release')) return 'product';

  return 'news';
}

function extractTitle(context: string): string {
  // Take first 60 characters as title
  const cleaned = context.replace(/[#*]/g, '').trim();
  return cleaned.length > 60 ? cleaned.substring(0, 60) + '...' : cleaned;
}

/**
 * Convert markdown formatting to plain text for display
 */
export function cleanMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1') // Bold
    .replace(/\*(.+?)\*/g, '$1') // Italic
    .replace(/\[(.+?)\]\(.+?\)/g, '$1') // Links
    .replace(/#+\s+/g, '') // Headers
    .trim();
}

/**
 * Format text for display with smart spacing
 */
export function formatIntelligenceText(text: string): string {
  return cleanMarkdown(text)
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => line.trim())
    .join('\n');
}
