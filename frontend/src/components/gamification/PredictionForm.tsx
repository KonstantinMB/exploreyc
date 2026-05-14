import { useState } from 'react';
import { motion } from 'framer-motion';
import { Send, Sparkles, ChevronDown } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

interface FounderInfo {
  count?: number;
  expertise?: string[];
  has_repeat_founder?: boolean;
  has_complementary_skills?: boolean;
}

interface PredictionFormProps {
  onSubmit: (data: {
    idea_description: string;
    industry: string;
    market_type: string;
    location?: string;
    founder_info?: FounderInfo;
  }) => Promise<void>;
  isLoading?: boolean;
}

export function PredictionForm({ onSubmit, isLoading = false }: PredictionFormProps) {
  const [expandAdvanced, setExpandAdvanced] = useState(false);
  const [formData, setFormData] = useState({
    idea_description: '',
    industry: '',
    market_type: 'B2B',
    location: '',
    founder_count: '',
    founder_expertise: '',
    has_repeat_founder: false,
    has_complementary_skills: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const founder_info = {
      count: formData.founder_count ? parseInt(formData.founder_count) : undefined,
      expertise: formData.founder_expertise ? formData.founder_expertise.split(',').map(e => e.trim()) : undefined,
      has_repeat_founder: formData.has_repeat_founder,
      has_complementary_skills: formData.has_complementary_skills,
    };

    await onSubmit({
      idea_description: formData.idea_description,
      industry: formData.industry,
      market_type: formData.market_type,
      location: formData.location || undefined,
      founder_info: Object.values(founder_info).some(v => v !== undefined && v !== false) ? founder_info : undefined,
    });
  };

  return (
    <motion.form
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      onSubmit={handleSubmit}
      className="space-y-6 max-w-2xl mx-auto"
    >
      {/* Idea Description */}
      <div className="space-y-2">
        <label className="block text-sm font-semibold text-foreground flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#FB651E]" />
          Your Startup Idea
        </label>
        <textarea
          value={formData.idea_description}
          onChange={(e) => setFormData({ ...formData, idea_description: e.target.value })}
          placeholder="Describe your startup idea, what problem you're solving, and how you're solving it..."
          className="w-full h-28 px-4 py-3 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#FB651E]/50 focus:border-transparent resize-none"
          required
        />
        <p className="text-xs text-muted-foreground">
          Minimum 10 characters. Be descriptive for better matching.
        </p>
      </div>

      {/* Industry */}
      <div className="space-y-2">
        <label className="block text-sm font-semibold text-foreground">
          Industry / Category
        </label>
        <Input
          value={formData.industry}
          onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
          placeholder="e.g., AI, FinTech, Healthcare, SaaS, Marketplace..."
          required
        />
      </div>

      {/* Market Type */}
      <div className="space-y-2">
        <label className="block text-sm font-semibold text-foreground">
          Market Type
        </label>
        <div className="grid grid-cols-3 gap-3">
          {['B2B', 'B2C', 'Platform'].map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setFormData({ ...formData, market_type: type })}
              className={`px-4 py-2 rounded-lg border transition-all ${
                formData.market_type === type
                  ? 'border-[#FB651E] bg-[#FB651E]/10 text-[#FB651E]'
                  : 'border-border bg-background text-foreground hover:border-[#FB651E]/50'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Location */}
      <div className="space-y-2">
        <label className="block text-sm font-semibold text-foreground">
          Location (Optional)
        </label>
        <Input
          value={formData.location}
          onChange={(e) => setFormData({ ...formData, location: e.target.value })}
          placeholder="e.g., San Francisco, London, Remote..."
        />
      </div>

      {/* Advanced - Team Information */}
      <div className="border-t border-border pt-6">
        <button
          type="button"
          onClick={() => setExpandAdvanced(!expandAdvanced)}
          className="flex items-center gap-2 text-sm font-semibold text-foreground hover:text-[#FB651E] transition-colors"
        >
          <ChevronDown
            className={`w-4 h-4 transition-transform ${expandAdvanced ? 'rotate-180' : ''}`}
          />
          Team Information (Optional)
        </button>

        {expandAdvanced && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-4 mt-4"
          >
            {/* Founder Count */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">
                Number of Founders
              </label>
              <Input
                type="number"
                min="1"
                max="10"
                value={formData.founder_count}
                onChange={(e) => setFormData({ ...formData, founder_count: e.target.value })}
                placeholder="e.g., 2"
              />
            </div>

            {/* Founder Expertise */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">
                Founder Expertise (Comma-separated)
              </label>
              <Input
                value={formData.founder_expertise}
                onChange={(e) => setFormData({ ...formData, founder_expertise: e.target.value })}
                placeholder="e.g., Product, Engineering, Sales"
              />
            </div>

            {/* Checkboxes */}
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.has_repeat_founder}
                  onChange={(e) => setFormData({ ...formData, has_repeat_founder: e.target.checked })}
                  className="w-4 h-4 rounded border-border"
                />
                <span className="text-sm text-foreground">
                  I/We have founded a previous startup (Repeat Founder)
                </span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.has_complementary_skills}
                  onChange={(e) => setFormData({ ...formData, has_complementary_skills: e.target.checked })}
                  className="w-4 h-4 rounded border-border"
                />
                <span className="text-sm text-foreground">
                  We have complementary skills on the team
                </span>
              </label>
            </div>
          </motion.div>
        )}
      </div>

      {/* Submit Button */}
      <div className="flex gap-3">
        <Button
          type="submit"
          disabled={!formData.idea_description || !formData.industry || isLoading}
          className="flex-1 bg-[#FB651E] hover:bg-[#FB651E]/90 text-white flex items-center justify-center gap-2"
        >
          <Send className="w-4 h-4" />
          {isLoading ? 'Analyzing...' : 'Get Your Success Score'}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        We analyze your idea against 5,772 YC companies to predict your success potential.
      </p>
    </motion.form>
  );
}
