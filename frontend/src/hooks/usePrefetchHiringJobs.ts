import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

/**
 * Hook to prefetch all hiring jobs on app startup
 * Fetches all pages in parallel and caches them for instant access
 */
export function usePrefetchHiringJobs() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const prefetchAllJobs = async () => {
      try {
        // First, fetch page 1 to get total_pages
        const response1 = await fetch('/api/hiring/jobs/paginated?page=1&per_page=20&sort_by=recent');
        if (!response1.ok) throw new Error('Failed to fetch first page');

        const data1 = await response1.json();
        const totalPages = data1.total_pages || 1;

        // Cache page 1
        queryClient.setQueryData(
          ['hiring-jobs-paginated', 1, { roles: [], batches: [], locations: [], jobTypes: [], experienceLevels: [], remote: 'all', salaryMin: null, salaryMax: null, searchQuery: '' }, 'recent'],
          data1
        );

        // Prefetch remaining pages in parallel (skip if only 1 page)
        if (totalPages > 1) {
          const pagePromises = Array.from({ length: totalPages - 1 }, (_, i) => {
            const pageNum = i + 2;
            return fetch(`/api/hiring/jobs/paginated?page=${pageNum}&per_page=20&sort_by=recent`)
              .then(res => {
                if (!res.ok) throw new Error(`Failed to fetch page ${pageNum}`);
                return res.json();
              })
              .then(data => {
                // Cache each page
                queryClient.setQueryData(
                  ['hiring-jobs-paginated', pageNum, { roles: [], batches: [], locations: [], jobTypes: [], experienceLevels: [], remote: 'all', salaryMin: null, salaryMax: null, searchQuery: '' }, 'recent'],
                  data
                );
              })
              .catch(err => {
                console.warn(`Failed to prefetch page ${pageNum}:`, err);
              });
          });

          await Promise.all(pagePromises);
          console.log(`✅ Prefetched all ${totalPages} pages of hiring jobs`);
        } else {
          console.log('✅ All hiring jobs prefetched');
        }
      } catch (error) {
        console.warn('Failed to prefetch hiring jobs:', error);
      }
    };

    prefetchAllJobs();
  }, [queryClient]);
}
