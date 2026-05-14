"""
OG Image Generator using Playwright
Generates Open Graph images for batch wrapped pages
"""
import asyncio
import logging
from typing import Dict, Optional
from playwright.async_api import async_playwright
import base64

logger = logging.getLogger(__name__)

OG_IMAGE_WIDTH = 1200
OG_IMAGE_HEIGHT = 630


class OGImageGenerator:
    """Generate Open Graph images using Playwright for server-side rendering"""

    def __init__(self):
        self.playwright = None
        self.browser = None

    async def initialize(self):
        """Initialize Playwright browser"""
        if not self.browser:
            self.playwright = await async_playwright().start()
            self.browser = await self.playwright.chromium.launch(headless=True)
            logger.info("Playwright browser initialized")

    async def close(self):
        """Close Playwright browser"""
        if self.browser:
            await self.browser.close()
        if self.playwright:
            await self.playwright.stop()
            logger.info("Playwright browser closed")

    async def generate_batch_wrapped_og_image(self, batch_stats: Dict) -> bytes:
        """
        Generate OG image for batch wrapped stats

        Args:
            batch_stats: Dictionary containing batch statistics

        Returns:
            PNG image as bytes
        """
        await self.initialize()

        # Create HTML template for the OG image
        html_content = self._create_html_template(batch_stats)

        # Create a new page
        page = await self.browser.new_page(
            viewport={"width": OG_IMAGE_WIDTH, "height": OG_IMAGE_HEIGHT}
        )

        try:
            # Set content and wait for fonts to load
            await page.set_content(html_content, wait_until="networkidle")

            # Take screenshot
            screenshot_bytes = await page.screenshot(
                type="png",
                full_page=False
            )

            logger.info(f"Generated OG image for batch {batch_stats.get('batch', 'unknown')}")
            return screenshot_bytes

        finally:
            await page.close()

    def _create_html_template(self, stats: Dict) -> str:
        """Create HTML template for OG image"""
        batch = stats.get('batch', 'Unknown')
        total = stats.get('total_companies', 0)
        hiring_pct = stats.get('hiring_percentage', 0)
        top_industry = stats.get('top_industries', [{}])[0] if stats.get('top_industries') else {}
        top_country = stats.get('top_countries', [{}])[0] if stats.get('top_countries') else {}
        fun_fact = stats.get('fun_fact', '')

        # YC Orange brand color
        yc_orange = "#FB651E"

        html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                * {{
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }}
                body {{
                    width: {OG_IMAGE_WIDTH}px;
                    height: {OG_IMAGE_HEIGHT}px;
                    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', sans-serif;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    overflow: hidden;
                }}
                .container {{
                    width: 100%;
                    height: 100%;
                    padding: 60px;
                    display: flex;
                    flex-direction: column;
                    justify-content: space-between;
                }}
                .header {{
                    display: flex;
                    align-items: center;
                    gap: 20px;
                }}
                .yc-logo {{
                    width: 80px;
                    height: 80px;
                    background: {yc_orange};
                    border-radius: 16px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 48px;
                    font-weight: bold;
                    color: white;
                }}
                .title {{
                    font-size: 72px;
                    font-weight: bold;
                    color: {yc_orange};
                    text-shadow: 2px 2px 8px rgba(0,0,0,0.3);
                }}
                .subtitle {{
                    font-size: 36px;
                    color: rgba(255,255,255,0.8);
                    margin-top: 10px;
                }}
                .stats {{
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 30px;
                    margin: 40px 0;
                }}
                .stat-card {{
                    background: rgba(255,255,255,0.1);
                    border: 2px solid rgba(251,101,30,0.3);
                    border-radius: 20px;
                    padding: 30px;
                    backdrop-filter: blur(10px);
                }}
                .stat-value {{
                    font-size: 56px;
                    font-weight: bold;
                    color: {yc_orange};
                    margin-bottom: 10px;
                }}
                .stat-label {{
                    font-size: 24px;
                    color: rgba(255,255,255,0.7);
                }}
                .footer {{
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }}
                .fun-fact {{
                    font-size: 22px;
                    color: rgba(255,255,255,0.8);
                    max-width: 70%;
                    font-style: italic;
                }}
                .branding {{
                    font-size: 20px;
                    color: rgba(255,255,255,0.6);
                    font-family: 'Courier New', monospace;
                }}
            </style>
        </head>
        <body>
            <div class="container">
                <div>
                    <div class="header">
                        <div class="yc-logo">Y</div>
                        <div>
                            <div class="title">{batch} Wrapped</div>
                            <div class="subtitle">Y Combinator Batch Stats</div>
                        </div>
                    </div>
                </div>

                <div class="stats">
                    <div class="stat-card">
                        <div class="stat-value">{total:,}</div>
                        <div class="stat-label">Companies</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">{hiring_pct}%</div>
                        <div class="stat-label">Hiring</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">{top_industry.get('name', 'N/A')[:20]}</div>
                        <div class="stat-label">Top Industry</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">{top_country.get('name', 'N/A')[:20]}</div>
                        <div class="stat-label">Top Country</div>
                    </div>
                </div>

                <div class="footer">
                    <div class="fun-fact">💡 {fun_fact[:100]}</div>
                    <div class="branding">exploreyc.com</div>
                </div>
            </div>
        </body>
        </html>
        """
        return html


# Singleton instance
_og_generator: Optional[OGImageGenerator] = None


def get_og_image_generator() -> OGImageGenerator:
    """Get or create singleton OG image generator"""
    global _og_generator
    if _og_generator is None:
        _og_generator = OGImageGenerator()
    return _og_generator
