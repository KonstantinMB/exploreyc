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
        # Override via RESEND_FROM_EMAIL on the host (e.g. "ExploreYC <digest@exploreyc.com>").
        self.from_email = os.environ.get("RESEND_FROM_EMAIL", "ExploreYC <digest@exploreyc.com>")
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
                "subject": "Welcome to ExploreYC — confirm your email",
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
        github_url = "https://github.com/KonstantinMB/exploreyc"
        return f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>You're in — ExploreYC</title>
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif; margin: 0; padding: 0; background-color: #f6f6ef; line-height: 1.5; }}
        .container {{ max-width: 600px; margin: 32px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.06); }}
        .content {{ padding: 32px; }}
    </style>
</head>
<body style="padding: 24px 0;">
    <!-- Preheader -->
    <div style="display: none; max-height: 0; overflow: hidden;">Your first ExploreYC digest is on the way — tomorrow by 10am.</div>

    <div class="container">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #FB651E 0%, #FF8833 100%); padding: 28px 32px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.3px;">
                ExploreYC <span style="opacity: 0.6;">·</span> You're in ✓
            </h1>
            <p style="color: rgba(255,255,255,0.9); margin: 6px 0 0 0; font-size: 13px; font-weight: 500;">
                Subscription confirmed
            </p>
        </div>

        <div class="content">
            <h2 style="color: #1a1a1a; font-size: 20px; margin: 0 0 12px 0; font-weight: 600; letter-spacing: -0.2px;">
                You're all set.
            </h2>
            <p style="color: #444; font-size: 15px; margin: 0 0 24px 0;">
                Your first digest lands in your inbox tomorrow by 10am UTC. After that, expect one email a day — only on days something actually changed in the YC portfolio.
            </p>

            <!-- What to expect -->
            <div style="background: #FFF8F4; border: 1px solid #FFE5D6; padding: 16px 20px; border-radius: 8px; margin: 0 0 28px 0;">
                <p style="margin: 0 0 10px 0; font-size: 13px; color: #555; font-weight: 600; text-transform: uppercase; letter-spacing: 0.4px;">What to expect</p>
                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                        <td style="padding: 4px 0; font-size: 14px; color: #333;">
                            <span style="color: #FB651E; font-weight: 700;">🆕</span>
                            &nbsp;New YC companies the moment they're added
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 4px 0; font-size: 14px; color: #333;">
                            <span style="color: #10B981; font-weight: 700;">💼</span>
                            &nbsp;Companies that just started hiring
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 4px 0; font-size: 14px; color: #333;">
                            <span style="color: #6366F1; font-weight: 700;">📊</span>
                            &nbsp;Batch transitions and portfolio changes
                        </td>
                    </tr>
                </table>
            </div>

            <p style="color: #444; font-size: 14px; margin: 0 0 18px 0;">
                In the meantime — the full directory, the idea validator, the hiring board, and a few other things are live on the site. Worth a look:
            </p>

            <!-- CTA button -->
            <table border="0" cellpadding="0" cellspacing="0" align="center" style="margin: 0 auto;">
                <tr>
                    <td style="background-color: #FB651E; border-radius: 8px;">
                        <a href="{self.frontend_url}" style="display: inline-block; padding: 14px 32px; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 15px;">
                            Explore on ExploreYC →
                        </a>
                    </td>
                </tr>
            </table>

            <p style="margin: 28px 0 0 0; font-size: 13px; color: #888; text-align: center;">
                Quick favor — if you like it, tell one founder friend. Word-of-mouth is what's growing this thing.
            </p>
        </div>

        <!-- Footer -->
        <div style="background: #f6f6ef; padding: 24px 32px; text-align: center; font-size: 13px; color: #666; border-top: 1px solid #ececec;">
            <p style="margin: 0 0 8px 0;">
                <strong style="color: #1a1a1a;">ExploreYC</strong> · Built for the YC-curious
            </p>
            <p style="margin: 0;">
                <a href="{self.frontend_url}" style="color: #FB651E; text-decoration: none; margin: 0 6px;">Live site</a>
                <span style="color: #ccc;">·</span>
                <a href="{github_url}" style="color: #FB651E; text-decoration: none; margin: 0 6px;">Now open source on GitHub</a>
            </p>
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
            return f"ExploreYC Digest — {len(new_companies)} New Companies ({today})"
        elif newly_hiring:
            return f"ExploreYC Digest — {len(newly_hiring)} Now Hiring ({today})"
        else:
            return f"ExploreYC Digest — {total_changes} Updates ({today})"

    def _render_verification_email(self, verification_link: str) -> str:
        """Render welcome + verification email HTML"""
        github_url = "https://github.com/KonstantinMB/exploreyc"
        return f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to ExploreYC</title>
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif; margin: 0; padding: 0; background-color: #f6f6ef; line-height: 1.5; }}
        .container {{ max-width: 600px; margin: 32px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.06); }}
        .content {{ padding: 32px; }}
    </style>
</head>
<body style="padding: 24px 0;">
    <!-- Preheader (preview text shown in inbox) -->
    <div style="display: none; max-height: 0; overflow: hidden;">One click to confirm your email and start receiving the daily YC digest.</div>

    <div class="container">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #FB651E 0%, #FF8833 100%); padding: 28px 32px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.3px;">
                ExploreYC <span style="opacity: 0.6;">·</span> Welcome
            </h1>
            <p style="color: rgba(255,255,255,0.9); margin: 6px 0 0 0; font-size: 13px; font-weight: 500;">
                One click to confirm
            </p>
        </div>

        <div class="content">
            <h2 style="color: #1a1a1a; font-size: 20px; margin: 0 0 12px 0; font-weight: 600; letter-spacing: -0.2px;">
                Thanks for signing up.
            </h2>
            <p style="color: #444; font-size: 15px; margin: 0 0 24px 0;">
                We scan Y Combinator's directory every day. Confirm your email and you'll get a digest in your inbox by 10am whenever something new lands.
            </p>

            <!-- CTA button -->
            <table border="0" cellpadding="0" cellspacing="0" align="center" style="margin: 0 auto 8px auto;">
                <tr>
                    <td style="background-color: #FB651E; border-radius: 8px;">
                        <a href="{verification_link}" style="display: inline-block; padding: 14px 36px; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 15px;">
                            Confirm my email →
                        </a>
                    </td>
                </tr>
            </table>

            <p style="text-align: center; font-size: 12px; color: #999; margin: 12px 0 28px 0;">
                Or paste this link into your browser:<br>
                <code style="background: #f0f0f0; padding: 4px 8px; border-radius: 4px; font-size: 11px; color: #555; word-break: break-all; display: inline-block; margin-top: 6px; max-width: 100%;">{verification_link}</code>
            </p>

            <!-- What you'll get -->
            <div style="background: #FFF8F4; border: 1px solid #FFE5D6; padding: 16px 20px; border-radius: 8px; margin: 8px 0 0 0;">
                <p style="margin: 0 0 10px 0; font-size: 13px; color: #555; font-weight: 600; text-transform: uppercase; letter-spacing: 0.4px;">What you'll get</p>
                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                        <td style="padding: 4px 0; font-size: 14px; color: #333;">
                            <span style="color: #FB651E; font-weight: 700;">🆕</span>
                            &nbsp;<strong>New YC companies</strong> — as soon as they're added to the directory
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 4px 0; font-size: 14px; color: #333;">
                            <span style="color: #10B981; font-weight: 700;">💼</span>
                            &nbsp;<strong>Hiring alerts</strong> — companies that just opened roles
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 4px 0; font-size: 14px; color: #333;">
                            <span style="color: #6366F1; font-weight: 700;">📊</span>
                            &nbsp;<strong>Batch updates</strong> — when companies move batches
                        </td>
                    </tr>
                </table>
            </div>

            <p style="margin: 24px 0 0 0; font-size: 13px; color: #888; text-align: center;">
                Didn't sign up? Just ignore this — we won't email you again.
            </p>
        </div>

        <!-- Footer -->
        <div style="background: #f6f6ef; padding: 24px 32px; text-align: center; font-size: 13px; color: #666; border-top: 1px solid #ececec;">
            <p style="margin: 0 0 8px 0;">
                <strong style="color: #1a1a1a;">ExploreYC</strong> · Built for the YC-curious
            </p>
            <p style="margin: 0;">
                <a href="{self.frontend_url}" style="color: #FB651E; text-decoration: none; margin: 0 6px;">Live site</a>
                <span style="color: #ccc;">·</span>
                <a href="{github_url}" style="color: #FB651E; text-decoration: none; margin: 0 6px;">Now open source on GitHub</a>
            </p>
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
        today = date.today().strftime("%A, %B %d, %Y")

        # Section accent colors — orange for new, green for hiring, indigo for updates.
        new_accent = "#FB651E"
        hiring_accent = "#10B981"
        batch_accent = "#6366F1"

        # Stats banner — a compact one-line summary right under the header.
        stats_parts = []
        if new_companies:
            stats_parts.append(
                f'<strong style="color: {new_accent};">{len(new_companies)}</strong> new'
            )
        if newly_hiring:
            stats_parts.append(
                f'<strong style="color: {hiring_accent};">{len(newly_hiring)}</strong> hiring'
            )
        if batch_changes:
            stats_parts.append(
                f'<strong style="color: {batch_accent};">{len(batch_changes)}</strong> updated'
            )
        stats_html = (
            '<span style="color: #cbd5e0;"> &nbsp;·&nbsp; </span>'.join(stats_parts)
        )

        # Build content sections.
        def render_section(emoji: str, count: int, label: str, items: List[Dict], accent: str) -> str:
            cards = "\n".join(self._render_company_card(c, accent) for c in items)
            return f"""
                <div style="margin: 0 0 32px 0;">
                    <div style="margin: 0 0 14px 0; padding-bottom: 10px; border-bottom: 2px solid {accent};">
                        <h2 style="color: {accent}; margin: 0; font-size: 17px; font-weight: 700; letter-spacing: -0.2px;">
                            {emoji} {count} {label}
                        </h2>
                    </div>
                    {cards}
                </div>
            """

        sections = []
        if new_companies:
            sections.append(render_section("🆕", len(new_companies), "New Companies", new_companies[:20], new_accent))
        if newly_hiring:
            sections.append(render_section("💼", len(newly_hiring), "Now Hiring", newly_hiring[:20], hiring_accent))
        if batch_changes:
            sections.append(render_section("📊", len(batch_changes), "Batch Updates", batch_changes[:10], batch_accent))

        github_url = "https://github.com/KonstantinMB/exploreyc"
        stats_banner = (
            f'<div style="background: #FFF8F4; border: 1px solid #FFE5D6; padding: 14px 20px; '
            f'border-radius: 8px; text-align: center; margin: 0 0 28px 0; font-size: 14px; color: #555;">'
            f"<span>Today's update: </span>&nbsp;{stats_html}"
            f'</div>'
        ) if stats_html else ""

        return f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ExploreYC Daily Digest</title>
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif; margin: 0; padding: 0; background-color: #f6f6ef; line-height: 1.5; }}
        .container {{ max-width: 600px; margin: 32px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.06); }}
        .content {{ padding: 32px; }}
    </style>
</head>
<body style="padding: 24px 0;">
    <div class="container">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #FB651E 0%, #FF8833 100%); padding: 28px 32px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.3px;">
                ExploreYC <span style="opacity: 0.6;">·</span> Daily Digest
            </h1>
            <p style="color: rgba(255,255,255,0.9); margin: 6px 0 0 0; font-size: 13px; font-weight: 500;">
                {today}
            </p>
        </div>

        <div class="content">
            {stats_banner}

            {"".join(sections)}

            <!-- CTA button -->
            <table border="0" cellpadding="0" cellspacing="0" align="center" style="margin: 8px auto 0 auto;">
                <tr>
                    <td style="background-color: #FB651E; border-radius: 8px;">
                        <a href="{self.frontend_url}" style="display: inline-block; padding: 14px 32px; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 15px;">
                            Browse all on ExploreYC →
                        </a>
                    </td>
                </tr>
            </table>
        </div>

        <!-- Footer -->
        <div style="background: #f6f6ef; padding: 24px 32px; text-align: center; font-size: 13px; color: #666; border-top: 1px solid #ececec;">
            <p style="margin: 0 0 8px 0;">
                <strong style="color: #1a1a1a;">ExploreYC</strong> · Built for the YC-curious
            </p>
            <p style="margin: 0;">
                <a href="{self.frontend_url}" style="color: #FB651E; text-decoration: none; margin: 0 6px;">Live site</a>
                <span style="color: #ccc;">·</span>
                <a href="{github_url}" style="color: #FB651E; text-decoration: none; margin: 0 6px;">Now open source on GitHub</a>
            </p>
            <p style="margin: 16px 0 0 0; font-size: 12px; color: #999;">
                <a href="{unsubscribe_link}" style="color: #999; text-decoration: underline;">Unsubscribe</a>
            </p>
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

    def _render_company_card(self, company: Dict, accent: str = "#FB651E") -> str:
        """Render a single company card in email.

        Uses table layout for email-client compatibility (Outlook, etc.).
        All links inline-styled so they render consistently even when
        clients strip <style> blocks.
        """
        name = company.get("name", "Unknown")
        batch = company.get("batch", "N/A")
        one_liner = (company.get("one_liner") or "").strip()
        website = company.get("website", "")
        slug = company.get("slug", "")
        is_hiring = company.get("is_hiring", False)
        logo = company.get("logo", "")

        hiring_badge = (
            '<span style="display: inline-block; background: #10B981; color: #ffffff; '
            'padding: 2px 8px; border-radius: 3px; font-size: 11px; font-weight: 500; margin-left: 6px;">Hiring</span>'
            if is_hiring else ""
        )

        # Logo cell — only emit if we have one.
        logo_cell = ""
        if logo:
            logo_cell = (
                f'<td width="56" valign="top" style="padding-right: 12px;">'
                f'<img src="{logo}" alt="" width="48" height="48" '
                f'style="display: block; width: 48px; height: 48px; border-radius: 8px; '
                f'object-fit: cover; border: 1px solid #eee;">'
                f'</td>'
            )

        # Links — every one inline-styled to render consistently in Gmail / Outlook / Apple Mail.
        link_style = (
            f'color: {accent}; text-decoration: none; font-weight: 500; font-size: 13px;'
        )
        links = []
        if self.frontend_url and slug:
            company_page_url = f"{self.frontend_url.rstrip('/')}/company/{slug}"
            links.append(
                f'<a href="{company_page_url}" style="{link_style} font-weight: 600;">View profile →</a>'
            )
        if website:
            links.append(f'<a href="{website}" style="{link_style}">Website →</a>')
        if slug:
            yc_url = f"https://www.ycombinator.com/companies/{slug}"
            links.append(f'<a href="{yc_url}" style="{link_style}">YC →</a>')
        sep = '<span style="color: #ccc; margin: 0 8px;">·</span>'
        links_html = sep.join(links) if links else ""

        description_html = (
            f'<p style="color: #555; font-size: 14px; margin: 8px 0 0 0; line-height: 1.45;">{one_liner}</p>'
            if one_liner else ""
        )
        links_block = (
            f'<div style="margin-top: 10px;">{links_html}</div>'
            if links_html else ""
        )

        return f"""
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background: #fafafa; border-left: 3px solid {accent}; border-radius: 0 6px 6px 0; margin-bottom: 10px;">
                <tr>
                    <td style="padding: 14px 16px;">
                        <table width="100%" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                                {logo_cell}
                                <td valign="top">
                                    <div style="font-weight: 600; color: #1a1a1a; font-size: 15px; line-height: 1.3;">{name}</div>
                                    <div style="margin-top: 6px;">
                                        <span style="display: inline-block; background: {accent}; color: #ffffff; padding: 2px 8px; border-radius: 3px; font-size: 11px; font-weight: 500;">{batch}</span>{hiring_badge}
                                    </div>
                                    {description_html}
                                    {links_block}
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>
        """
