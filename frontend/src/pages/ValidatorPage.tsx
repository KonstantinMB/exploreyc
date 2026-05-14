import { motion } from 'framer-motion';
import { ArrowLeft, Lightbulb } from 'lucide-react';
import { AppProvider } from '../contexts/AppContext';
import { IdeaValidator } from '../components/IdeaValidator';
import { AnnouncementBanner } from '../components/AnnouncementBanner';

function ValidatorContent() {
  return (
    <>
      <AnnouncementBanner />
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8 max-w-3xl">
        {/* Back link */}
        <a
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-[#FB651E] font-mono mb-8 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Explorer
        </a>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-[#FB651E]/10 rounded-lg">
              <Lightbulb className="h-6 w-6 text-[#FB651E]" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">
              Startup Idea Validator
            </h1>
          </div>
          <p className="text-sm text-muted-foreground font-mono">
            Check if your idea already exists in 5,773 YC companies
          </p>
        </motion.div>

        {/* Validator */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <IdeaValidator />
        </motion.div>
        </div>
      </div>
    </>
  );
}

export function ValidatorPage() {
  return (
    <AppProvider>
      <ValidatorContent />
    </AppProvider>
  );
}
