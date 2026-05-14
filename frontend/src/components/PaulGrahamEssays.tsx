import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ExternalLink, Sparkles, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { PGEssaysSVG } from './illustrations/CustomSVGs';

interface Essay {
  title: string;
  url: string;
}

// Curated list of popular Paul Graham essays
const POPULAR_ESSAYS: Essay[] = [
  { title: 'How to Start a Startup', url: 'https://paulgraham.com/start.html' },
  { title: 'Do Things that Don\'t Scale', url: 'https://paulgraham.com/ds.html' },
  { title: 'Make Something People Want', url: 'https://paulgraham.com/good.html' },
  { title: 'The 18 Mistakes That Kill Startups', url: 'https://paulgraham.com/startupmistakes.html' },
  { title: 'How to Get Startup Ideas', url: 'https://paulgraham.com/startupideas.html' },
  { title: 'Founder Mode', url: 'https://paulgraham.com/foundermode.html' },
  { title: 'Schlep Blindness', url: 'https://paulgraham.com/schlep.html' },
  { title: 'Default Alive or Default Dead?', url: 'https://paulgraham.com/aord.html' },
  { title: 'How to Convince Investors', url: 'https://paulgraham.com/convince.html' },
  { title: 'The Hardest Lessons for Startups to Learn', url: 'https://paulgraham.com/startuplessons.html' },
  { title: 'A Student\'s Guide to Startups', url: 'https://paulgraham.com/mit.html' },
  { title: 'The Top Idea in Your Mind', url: 'https://paulgraham.com/top.html' },
  { title: 'Relentlessly Resourceful', url: 'https://paulgraham.com/relres.html' },
  { title: 'How to Be an Expert in a Changing World', url: 'https://paulgraham.com/ecw.html' },
  { title: 'Mean People Fail', url: 'https://paulgraham.com/mean.html' },
  { title: 'Frighteningly Ambitious Startup Ideas', url: 'https://paulgraham.com/ambitious.html' },
  { title: 'The Airbnbs', url: 'https://paulgraham.com/airbnb.html' },
  { title: 'Black Swan Farming', url: 'https://paulgraham.com/swan.html' },
  { title: 'Why Startups = Growth', url: 'https://paulgraham.com/growth.html' },
  { title: 'Organic Startup Ideas', url: 'https://paulgraham.com/organic.html' },
];

export function PaulGrahamEssays() {
  const [randomEssay, setRandomEssay] = useState<Essay | null>(null);
  const [allEssays] = useState<Essay[]>(POPULAR_ESSAYS);

  const getRandomEssay = () => {
    const random = allEssays[Math.floor(Math.random() * allEssays.length)];
    setRandomEssay(random);
  };

  useEffect(() => {
    getRandomEssay();
  }, []);

  return (
    <Card className="border-[#FB651E]/20 bg-gradient-to-br from-background to-[#FB651E]/5">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <PGEssaysSVG className="h-6 w-6" />
            Paul Graham Essays
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={getRandomEssay}
            className="text-[#FB651E] hover:bg-[#FB651E]/10"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Random
          </Button>
        </div>
        <p className="text-sm text-muted-foreground font-mono">
          Wisdom from YC's co-founder
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Featured random essay */}
        {randomEssay && (
          <motion.div
            key={randomEssay.url}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[#FB651E]/10 border border-[#FB651E]/20 rounded-lg p-4"
          >
            <div className="flex items-start gap-3">
              <div className="bg-[#FB651E]/20 p-2 rounded-lg flex-shrink-0">
                <Sparkles className="h-5 w-5 text-[#FB651E]" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold mb-1 text-sm">Recommended Read</h4>
                <a
                  href={randomEssay.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#FB651E] hover:underline font-mono text-sm flex items-center gap-1 group"
                >
                  {randomEssay.title}
                  <ExternalLink className="h-3 w-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </a>
              </div>
            </div>
          </motion.div>
        )}

        {/* Quick links */}
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground mb-2 font-mono">
            POPULAR ESSAYS
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto">
            {allEssays.slice(0, 10).map((essay) => (
              <a
                key={essay.url}
                href={essay.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-mono text-muted-foreground hover:text-[#FB651E] transition-colors flex items-center gap-1 group p-2 rounded hover:bg-[#FB651E]/5"
              >
                <span className="truncate">{essay.title}</span>
                <ExternalLink className="h-3 w-3 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
              </a>
            ))}
          </div>
        </div>

        <div className="pt-3 border-t">
          <a
            href="https://paulgraham.com/articles.html"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-mono text-[#FB651E] hover:underline flex items-center gap-1"
          >
            View all essays →
          </a>
        </div>
      </CardContent>
    </Card>
  );
}
