/**
 * Generate QR code using Google Charts API (free, no library needed)
 * Alternative: Use qrcode.react library if we want to generate client-side
 */
export function generateQRCodeURL(data: string, size: number = 200): string {
  const encodedData = encodeURIComponent(data);
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodedData}`;
}

export function getCompanyCardURL(slug: string): string {
  const baseURL = window.location.origin;
  return `${baseURL}/company/${slug}`;
}
