import { type RefObject, useState } from 'react';
import html2canvas from 'html2canvas';

interface UseImageExportReturn {
  exporting: boolean;
  exportAsImage: (filename?: string) => Promise<void>;
  error: string | null;
}

export function useImageExport(elementRef: RefObject<HTMLElement | null>): UseImageExportReturn {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exportAsImage = async (filename: string = 'yc-explorer-share') => {
    if (!elementRef.current) {
      setError('No element to export');
      return;
    }

    try {
      setExporting(true);
      setError(null);

      const canvas = await html2canvas(elementRef.current, {
        backgroundColor: '#F6F6EF',
        scale: 2, // Higher quality for retina displays
        logging: false,
        useCORS: true, // Allow cross-origin images
        allowTaint: true,
      });

      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `${filename}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        }
      }, 'image/png');
    } catch (err) {
      console.error('Error exporting image:', err);
      setError('Failed to export image. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  return { exporting, exportAsImage, error };
}
