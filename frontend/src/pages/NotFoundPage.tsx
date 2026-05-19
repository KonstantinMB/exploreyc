import { Link, useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowLeft } from 'lucide-react';

export function NotFoundPage() {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>404 Not Found — ExploreYC</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <div className="container mx-auto px-4 py-16 max-w-2xl">
        <div className="font-mono text-muted-foreground text-sm mb-4">
          $ cd <span className="text-[#FB651E]">{location.pathname}</span>
        </div>
        <div className="font-mono text-muted-foreground text-sm mb-8">
          <span className="text-red-500">error:</span> no such file or directory
        </div>

        <h1 className="text-4xl font-bold mb-3">
          <span className="font-mono text-[#FB651E]">&gt;</span> Page not found
        </h1>
        <p className="text-muted-foreground font-mono mb-8">
          The page you're looking for doesn't exist on ExploreYC — yet.
          If you followed a link from somewhere else, it might be stale.
        </p>

        <div className="flex flex-col gap-2 font-mono text-sm">
          <div className="text-muted-foreground mb-2">Try one of these:</div>
          <Link to="/" className="text-[#FB651E] hover:underline">→ Home (the YC company explorer)</Link>
          <Link to="/hiring" className="text-[#FB651E] hover:underline">→ Hiring board</Link>
          <Link to="/validator" className="text-[#FB651E] hover:underline">→ Idea validator</Link>
          <Link to="/analytics/batches" className="text-[#FB651E] hover:underline">→ Batch analytics</Link>
          <Link to="/founders" className="text-[#FB651E] hover:underline">→ For founders</Link>
        </div>

        <div className="mt-12 pt-6 border-t border-border">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-mono text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
