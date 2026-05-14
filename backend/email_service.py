"""
Email service using Resend for daily YC company digests
"""

import os
import logging
from typing import List, Dict
from datetime import date

logger = logging.getLogger(__name__)

try:
    import resend
    HAS_RESEND = True
except ImportError:
    HAS_RESEND = False
    logger.warning("Resend package not installed. Email functionality will be disabled.")


class EmailService:
    """Send emails via Resend"""

    def __init__(self):
        self.api_key = os.environ.get("RESEND_API_KEY")
        if not self.api_key:
            logger.warning("RESEND_API_KEY not set. Email functionality will be disabled.")
            return

        if not HAS_RESEND:
            logger.error("Resend package not installed. Run: pip install resend")
            return

        resend.api_key = self.api_key
        # Use your verified domain. Set RESEND_FROM_EMAIL in Railway (e.g. YC Explorer <digest@exploreyc.com>)
        self.from_email = os.environ.get("RESEND_FROM_EMAIL", "YC Explorer <digest@exploreyc.com>")
        self.frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:5173")

    def send_verification_email(self, email: str, verification_token: str) -> bool:
        """Send welcome + verification email"""
        if not self.api_key or not HAS_RESEND:
            logger.warning(f"Skipping verification email to {email} (Resend not configured)")
            return False

        verification_link = f"{self.frontend_url}/verify-email?token={verification_token}"

        try:
            params = {
                "from": self.from_email,
                "to": [email],
                "subject": "Welcome to YC Explorer — confirm your email",
                "html": self._render_verification_email(verification_link)
            }

            response = resend.Emails.send(params)
            logger.info(f"Verification email sent to {email}: {response}")
            return True
        except Exception as e:
            logger.error(f"Failed to send verification email to {email}: {e}")
            return False

    def send_welcome_confirmation(self, email: str) -> bool:
        """Send 'You're in!' confirmation after verification"""
        if not self.api_key or not HAS_RESEND:
            return False

        try:
            params = {
                "from": self.from_email,
                "to": [email],
                "subject": "You're in! Your first digest is coming soon",
                "html": self._render_welcome_confirmation()
            }
            resend.Emails.send(params)
            logger.info(f"Welcome confirmation sent to {email}")
            return True
        except Exception as e:
            logger.error(f"Failed to send welcome confirmation to {email}: {e}")
            return False

    def _render_welcome_confirmation(self) -> str:
        """Render post-verification welcome email"""
        return f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #F6F6EF; line-height: 1.6; }}
        .container {{ max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }}
        .header {{ background: linear-gradient(135deg, #FB651E 0%, #FF8833 100%); padding: 36px; text-align: center; }}
        .header h1 {{ color: white; margin: 0; font-size: 24px; font-weight: 700; }}
        .content {{ padding: 36px 32px; }}
        .content p {{ color: #444; font-size: 16px; margin: 0 0 16px 0; }}
        .cta {{ text-align: center; margin: 28px 0; }}
        .cta a {{ display: inline-block; background: #FB651E; color: white !important; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; }}
        .footer {{ background: #F6F6EF; padding: 24px; text-align: center; font-size: 13px; color: #666; }}
        .footer a {{ color: #FB651E; text-decoration: none; }}
    </style>
</head>
<body style="padding: 24px 0;">
    <div class="container">
        <div class="header">
            <h1>You're all set! ✓</h1>
        </div>
        <div class="content">
            <p>Your email is verified. You're now subscribed to YC Explorer daily digests.</p>
            <p>We scan Y Combinator's directory every day. When new companies join or existing ones start hiring, you'll get an email with the details — usually in your inbox by 10am.</p>
            <p>Nothing to do now. Just sit back and we'll keep you in the loop.</p>
            <div class="cta">
                <a href="{self.frontend_url}">Explore companies now →</a>
            </div>
        </div>
        <div class="footer">
            <p>YC Explorer • <a href="{self.frontend_url}">exploreyc.com</a></p>
        </div>
    </div>
</body>
</html>
"""

    def send_daily_digest(
        self,
        email: str,
        unsubscribe_token: str,
        new_companies: List[Dict],
        newly_hiring: List[Dict],
        batch_changes: List[Dict]
    ) -> bool:
        """Send daily digest email"""
        if not self.api_key or not HAS_RESEND:
            logger.warning(f"Skipping daily digest to {email} (Resend not configured)")
            return False

        # Skip if no changes
        if not new_companies and not newly_hiring and not batch_changes:
            logger.info(f"No changes to report for {email}, skipping email")
            return False

        unsubscribe_link = f"{self.frontend_url}/unsubscribe?token={unsubscribe_token}"

        try:
            params = {
                "from": self.from_email,
                "to": [email],
                "subject": self._get_subject_line(new_companies, newly_hiring, batch_changes),
                "html": self._render_daily_digest(
                    new_companies,
                    newly_hiring,
                    batch_changes,
                    unsubscribe_link
                )
            }

            response = resend.Emails.send(params)
            logger.info(f"Daily digest sent to {email}: {response}")
            return True
        except Exception as e:
            logger.error(f"Failed to send daily digest to {email}: {e}")
            return False

    def _get_subject_line(
        self, new_companies: List[Dict], newly_hiring: List[Dict], batch_changes: List[Dict]
    ) -> str:
        """Generate email subject line"""
        today = date.today().strftime("%B %d, %Y")
        total_changes = len(new_companies) + len(newly_hiring) + len(batch_changes)

        if new_companies:
            return f"YC Daily Digest - {len(new_companies)} New Companies ({today})"
        elif newly_hiring:
            return f"YC Daily Digest - {len(newly_hiring)} Now Hiring ({today})"
        else:
            return f"YC Daily Digest - {total_changes} Updates ({today})"

    def _render_verification_email(self, verification_link: str) -> str:
        """Render welcome + verification email HTML (themed, friendly)"""
        return f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif; margin: 0; padding: 0; background-color: #F6F6EF; line-height: 1.6; }}
        .container {{ max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }}
        .header {{ background: linear-gradient(135deg, #FB651E 0%, #FF8833 100%); padding: 36px 32px; text-align: center; }}
        .header h1 {{ color: white; margin: 0; font-size: 26px; font-weight: 700; letter-spacing: -0.5px; }}
        .header p {{ color: rgba(255,255,255,0.95); margin: 8px 0 0 0; font-size: 15px; }}
        .content {{ padding: 36px 32px; }}
        .content h2 {{ color: #1a1a1a; font-size: 20px; margin: 0 0 16px 0; font-weight: 600; }}
        .content p {{ color: #444; font-size: 16px; margin: 0 0 16px 0; }}
        .highlight {{ background: #FFF8F4; border-left: 4px solid #FB651E; padding: 16px 20px; margin: 24px 0; border-radius: 0 8px 8px 0; }}
        .highlight p {{ margin: 0; color: #333; font-size: 15px; }}
        .button {{ display: inline-block; background: #FB651E; color: white !important; padding: 16px 36px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; margin: 24px 0; box-shadow: 0 2px 12px rgba(251,101,30,0.35); }}
        .button:hover {{ background: #E65C00; }}
        .features {{ margin: 28px 0; }}
        .feature {{ display: flex; align-items: flex-start; margin-bottom: 16px; }}
        .feature-icon {{ font-size: 20px; margin-right: 12px; flex-shrink: 0; }}
        .feature-text {{ color: #444; font-size: 15px; }}
        .feature-text strong {{ color: #1a1a1a; }}
        .footer {{ background: #F6F6EF; padding: 24px 32px; text-align: center; font-size: 13px; color: #666; }}
        .footer a {{ color: #FB651E; text-decoration: none; }}
        .verify-note {{ font-size: 13px; color: #888; margin-top: 20px; }}
        .verify-note code {{ background: #f0f0f0; padding: 2px 6px; border-radius: 4px; font-size: 12px; word-break: break-all; }}
    </style>
</head>
<body style="padding: 24px 0;">
    <div class="container">
        <div class="header">
            <h1>Welcome to YC Explorer 🚀</h1>
            <p>You're one click away from staying in the loop</p>
        </div>
        <div class="content">
            <h2>Hey there!</h2>
            <p>Thanks for signing up. We're excited to have you.</p>
            <p>We scan Y Combinator's directory <strong>every day</strong> to catch new startups and hiring updates. Once you verify your email, you'll get a daily digest with exactly what's new.</p>

            <div class="highlight">
                <p><strong>What you'll get:</strong></p>
                <p style="margin-top: 8px;">🆕 <strong>New companies</strong> — Fresh YC startups as soon as they're added</p>
                <p>💼 <strong>Hiring alerts</strong> — Companies that just opened roles</p>
                <p>📊 <strong>Batch updates</strong> — When companies move batches</p>
            </div>

            <p style="text-align: center;">
                <a href="{verification_link}" class="button">Confirm my email</a>
            </p>
            <p class="verify-note">Or copy this link: <br><code>{verification_link}</code></p>
        </div>
        <div class="footer">
            <p>YC Explorer • Explore Y Combinator startups</p>
            <p><a href="{self.frontend_url}">exploreyc.com</a></p>
        </div>
    </div>
</body>
</html>
"""

    def _render_daily_digest(
        self,
        new_companies: List[Dict],
        newly_hiring: List[Dict],
        batch_changes: List[Dict],
        unsubscribe_link: str
    ) -> str:
        """Render daily digest email HTML"""
        today = date.today().strftime("%B %d, %Y")

        # Build sections
        sections = []

        if new_companies:
            companies_html = "\n".join([
                self._render_company_card(company) for company in new_companies[:20]
            ])
            sections.append(f"""
                <div class="section">
                    <h2>🆕 {len(new_companies)} New Companies Added</h2>
                    {companies_html}
                </div>
            """)

        if newly_hiring:
            companies_html = "\n".join([
                self._render_company_card(company) for company in newly_hiring[:20]
            ])
            sections.append(f"""
                <div class="section">
                    <h2>💼 {len(newly_hiring)} Now Hiring</h2>
                    {companies_html}
                </div>
            """)

        if batch_changes:
            companies_html = "\n".join([
                self._render_company_card(company) for company in batch_changes[:10]
            ])
            sections.append(f"""
                <div class="section">
                    <h2>📊 {len(batch_changes)} Batch Updates</h2>
                    {companies_html}
                </div>
            """)

        return f"""
<!DOCTYPE html>
<html>
<head>
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f6f6ef; }}
        .container {{ max-width: 600px; margin: 40px auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }}
        .header {{ background: #FB651E; padding: 30px; text-align: center; }}
        .header h1 {{ color: white; margin: 0; font-size: 24px; }}
        .header p {{ color: rgba(255,255,255,0.9); margin: 5px 0 0 0; }}
        .content {{ padding: 30px; }}
        .section {{ margin-bottom: 30px; }}
        .section h2 {{ color: #FB651E; margin-bottom: 15px; font-size: 18px; }}
        .company-card {{ background: #f9f9f9; border-left: 3px solid #FB651E; padding: 15px; margin-bottom: 12px; border-radius: 4px; min-height: 60px; }}
        .company-name {{ font-weight: 600; color: #333; margin-bottom: 5px; font-size: 16px; }}
        .company-batch {{ display: inline-block; background: #FB651E; color: white; padding: 2px 8px; border-radius: 3px; font-size: 11px; margin-right: 8px; }}
        .company-hiring {{ display: inline-block; background: #4CAF50; color: white; padding: 2px 8px; border-radius: 3px; font-size: 11px; }}
        .company-description {{ color: #666; font-size: 14px; margin-top: 5px; margin-bottom: 8px; line-height: 1.4; }}
        .company-links {{ margin-top: 8px; font-size: 13px; }}
        .company-link {{ color: #FB651E; text-decoration: none; font-size: 13px; }}
        .footer {{ background: #f6f6ef; padding: 20px; text-align: center; font-size: 12px; color: #666; }}
        .footer a {{ color: #FB651E; text-decoration: none; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎯 YC Explorer Daily Digest</h1>
            <p>{today}</p>
        </div>
        <div class="content">
            {"".join(sections)}
            <p style="text-align: center; margin-top: 30px;">
                <a href="{self.frontend_url}" style="color: #FB651E; text-decoration: none; font-weight: 600;">
                    View all companies →
                </a>
            </p>
        </div>
        <div class="footer">
            <p>YC Explorer • Made for developers and founders</p>
            <p><a href="{unsubscribe_link}">Unsubscribe</a></p>
        </div>
    </div>
</body>
</html>
"""

    def send_contact_form(self, email: str, message: str, name: str = "") -> bool:
        """Send contact/feature idea form to ideas@exploreyc.com"""
        if not self.api_key or not HAS_RESEND:
            logger.warning("Skipping contact form (Resend not configured)")
            return False

        to_email = os.environ.get("CONTACT_EMAIL", "ideas@exploreyc.com")
        subject = f"Feature idea from {email}" if name else f"Contact form: {email}"
        import html
        escaped_msg = html.escape(message).replace('\n', '<br>')
        body = f"""
        <p><strong>From:</strong> {html.escape(name or '(no name)')} &lt;{html.escape(email)}&gt;</p>
        <p><strong>Message:</strong></p>
        <p>{escaped_msg}</p>
        """
        try:
            params = {
                "from": self.from_email,
                "to": [to_email],
                "reply_to": email,
                "subject": subject,
                "html": f"<div style='font-family:sans-serif;'>{body}</div>",
            }
            resend.Emails.send(params)
            logger.info(f"Contact form sent from {email}")
            return True
        except Exception as e:
            logger.error(f"Failed to send contact form: {e}")
            return False

    def _render_company_card(self, company: Dict) -> str:
        """Render a single company card in email"""
        name = company.get("name", "Unknown")
        batch = company.get("batch", "N/A")
        one_liner = company.get("one_liner", "")
        website = company.get("website", "#")
        slug = company.get("slug", "")
        company_id = company.get("id")
        is_hiring = company.get("is_hiring", False)
        logo = company.get("logo", "")

        hiring_badge = '<span class="company-hiring">Hiring</span>' if is_hiring else ""

        # Logo section - show if available
        logo_html = ""
        if logo:
            logo_html = f'''
                <img src="{logo}"
                     alt="{name} logo"
                     style="width: 48px; height: 48px; border-radius: 8px; object-fit: cover; margin-right: 12px; float: left;"
                     onerror="this.style.display='none'">
            '''

        links = []
        # Link to dedicated company page with funding info
        if self.frontend_url and slug:
            company_page_url = f"{self.frontend_url.rstrip('/')}/company/{slug}"
            links.append(f'<a href="{company_page_url}" class="company-link" style="font-weight: 600; color: #FB651E;">View Full Profile →</a>')
        if website and website != "#":
            links.append(f'<a href="{website}" class="company-link">Website →</a>')
        if slug:
            yc_url = f"https://www.ycombinator.com/companies/{slug}"
            links.append(f'<a href="{yc_url}" class="company-link">YC Page →</a>')
        links_html = " &nbsp;|&nbsp; ".join(links) if links else ""

        return f"""
            <div class="company-card" style="overflow: auto;">
                {logo_html}
                <div style="overflow: hidden;">
                    <div class="company-name">{name}</div>
                    <div>
                        <span class="company-batch">{batch}</span>
                        {hiring_badge}
                    </div>
                    {f'<p class="company-description">{one_liner}</p>' if one_liner else ""}
                    {f'<div class="company-links">{links_html}</div>' if links_html else ""}
                </div>
            </div>
        """
