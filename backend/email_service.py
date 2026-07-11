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


# Shared design tokens matching the frontend hacker/terminal aesthetic.
# Kept inline because most email clients strip <style> blocks aggressively;
# we still ship a <style> for clients that respect it, but every template
# falls back to inline styles for safety.
_ORANGE = "#FB651E"
_ORANGE_HOVER = "#E65C00"
_BG = "#f8f8f6"        # matches frontend light theme bg
_CARD_BG = "#ffffff"
_TEXT = "#18181b"      # frontend foreground
_MUTED = "#71717a"     # muted-foreground
_BORDER = "#e5e5e5"
_MONO = "'JetBrains Mono', 'IBM Plex Mono', ui-monospace, Menlo, Monaco, Consolas, monospace"


def _base_styles() -> str:
    """Inline-friendly stylesheet shared by every template."""
    return f"""
        body {{
            font-family: {_MONO};
            margin: 0;
            padding: 0;
            background-color: {_BG};
            color: {_TEXT};
            font-size: 14px;
            line-height: 1.6;
        }}
        .container {{
            max-width: 600px;
            margin: 32px auto;
            background: {_CARD_BG};
            border: 1px solid {_BORDER};
            border-radius: 2px;
        }}
        .accent {{
            height: 3px;
            background: {_ORANGE};
        }}
        .header {{
            padding: 28px 28px 20px 28px;
            border-bottom: 1px solid {_BORDER};
        }}
        .prompt {{
            color: {_MUTED};
            font-size: 12px;
            margin: 0 0 10px 0;
        }}
        .prompt .caret {{ color: {_ORANGE}; }}
        .title {{
            margin: 0;
            font-size: 22px;
            font-weight: 700;
            color: {_TEXT};
            letter-spacing: -0.2px;
        }}
        .title .caret {{ color: {_ORANGE}; margin-right: 6px; }}
        .subtitle {{
            margin: 8px 0 0 0;
            color: {_MUTED};
            font-size: 13px;
        }}
        .content {{ padding: 24px 28px; }}
        .content p {{ margin: 0 0 14px 0; color: {_TEXT}; font-size: 14px; }}
        .label {{
            display: inline-block;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: {_MUTED};
            margin: 0 0 12px 0;
        }}
        .section {{ margin: 0 0 28px 0; }}
        .section-heading {{
            margin: 0 0 14px 0;
            font-size: 15px;
            font-weight: 700;
            color: {_TEXT};
        }}
        .section-heading .caret {{ color: {_ORANGE}; margin-right: 6px; }}
        .button {{
            display: inline-block;
            background: {_ORANGE};
            color: #ffffff !important;
            padding: 12px 22px;
            text-decoration: none;
            font-family: {_MONO};
            font-weight: 600;
            font-size: 13px;
            border-radius: 2px;
            letter-spacing: 0.02em;
        }}
        .button:hover {{ background: {_ORANGE_HOVER}; }}
        .code {{
            font-family: {_MONO};
            background: {_BG};
            border: 1px solid {_BORDER};
            padding: 10px 12px;
            border-radius: 2px;
            font-size: 12px;
            color: {_TEXT};
            word-break: break-all;
        }}
        .company-card {{
            border: 1px solid {_BORDER};
            border-left: 2px solid {_ORANGE};
            padding: 14px 16px;
            margin: 0 0 10px 0;
            border-radius: 2px;
            background: {_CARD_BG};
        }}
        .company-name {{
            font-weight: 700;
            color: {_TEXT};
            font-size: 15px;
            margin: 0 0 4px 0;
        }}
        .company-meta {{ margin: 4px 0 8px 0; font-size: 11px; }}
        .badge {{
            display: inline-block;
            padding: 2px 8px;
            border-radius: 2px;
            font-size: 11px;
            font-family: {_MONO};
            margin-right: 6px;
            letter-spacing: 0.02em;
        }}
        .badge-batch {{ background: {_ORANGE}; color: #ffffff; }}
        .badge-hiring {{ background: #10b981; color: #ffffff; }}
        .badge-arrow {{
            background: {_BG};
            border: 1px solid {_BORDER};
            color: {_TEXT};
        }}
        .company-desc {{
            color: {_MUTED};
            font-size: 13px;
            margin: 6px 0 8px 0;
            line-height: 1.5;
        }}
        .company-links {{ font-size: 12px; }}
        .company-link {{
            color: {_ORANGE};
            text-decoration: none;
            margin-right: 10px;
        }}
        .company-link.primary {{ font-weight: 600; }}
        .footer {{
            padding: 20px 28px;
            border-top: 1px solid {_BORDER};
            text-align: center;
            font-size: 12px;
            color: {_MUTED};
        }}
        .footer a {{ color: {_ORANGE}; text-decoration: none; }}
    """


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
                "subject": "[ExploreYC] confirm your email",
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
                "subject": "[ExploreYC] subscription confirmed",
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
        return f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Subscription confirmed</title>
    <style>{_base_styles()}</style>
</head>
<body style="margin:0;padding:0;background-color:{_BG};font-family:{_MONO};">
    <div class="container" style="max-width:600px;margin:32px auto;background:{_CARD_BG};border:1px solid {_BORDER};border-radius:2px;">
        <div class="accent" style="height:3px;background:{_ORANGE};"></div>
        <div class="header" style="padding:28px 28px 20px 28px;border-bottom:1px solid {_BORDER};">
            <p class="prompt" style="color:{_MUTED};font-size:12px;margin:0 0 10px 0;font-family:{_MONO};">
                <span style="color:{_ORANGE};">$</span> exploreyc subscribe --confirm
            </p>
            <h1 class="title" style="margin:0;font-size:22px;font-weight:700;color:{_TEXT};font-family:{_MONO};">
                <span style="color:{_ORANGE};margin-right:6px;">&gt;</span>Subscription confirmed
            </h1>
            <p class="subtitle" style="margin:8px 0 0 0;color:{_MUTED};font-size:13px;font-family:{_MONO};">
                You're in. Daily digests will land in your inbox around 10:00 UTC.
            </p>
        </div>
        <div class="content" style="padding:24px 28px;font-family:{_MONO};">
            <p style="margin:0 0 14px 0;color:{_TEXT};font-size:14px;">
                We scan Y Combinator's directory every day and ship a digest when something
                interesting happens — new companies, batch moves, fresh hiring activity.
            </p>
            <p style="margin:0 0 20px 0;color:{_TEXT};font-size:14px;">
                Quiet days mean a quiet inbox. We don't send filler.
            </p>
            <p style="text-align:center;margin:24px 0 4px 0;">
                <a href="{self.frontend_url}" class="button" style="display:inline-block;background:{_ORANGE};color:#ffffff;padding:12px 22px;text-decoration:none;font-family:{_MONO};font-weight:600;font-size:13px;border-radius:2px;">
                    Explore companies &rarr;
                </a>
            </p>
        </div>
        <div class="footer" style="padding:20px 28px;border-top:1px solid {_BORDER};text-align:center;font-size:12px;color:{_MUTED};font-family:{_MONO};">
            ExploreYC &middot; <a href="{self.frontend_url}" style="color:{_ORANGE};text-decoration:none;">exploreyc.com</a>
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
        today = date.today().strftime("%Y-%m-%d")

        if new_companies:
            n = len(new_companies)
            return f"[ExploreYC {today}] +{n} new {'company' if n == 1 else 'companies'}"
        if newly_hiring:
            return f"[ExploreYC {today}] {len(newly_hiring)} now hiring"
        n = len(batch_changes)
        return f"[ExploreYC {today}] {n} update{'' if n == 1 else 's'}"

    def _render_verification_email(self, verification_link: str) -> str:
        """Render welcome + verification email HTML"""
        return f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Confirm your email</title>
    <style>{_base_styles()}</style>
</head>
<body style="margin:0;padding:0;background-color:{_BG};font-family:{_MONO};">
    <div class="container" style="max-width:600px;margin:32px auto;background:{_CARD_BG};border:1px solid {_BORDER};border-radius:2px;">
        <div class="accent" style="height:3px;background:{_ORANGE};"></div>
        <div class="header" style="padding:28px 28px 20px 28px;border-bottom:1px solid {_BORDER};">
            <p class="prompt" style="color:{_MUTED};font-size:12px;margin:0 0 10px 0;font-family:{_MONO};">
                <span style="color:{_ORANGE};">$</span> exploreyc subscribe --verify
            </p>
            <h1 class="title" style="margin:0;font-size:22px;font-weight:700;color:{_TEXT};font-family:{_MONO};">
                <span style="color:{_ORANGE};margin-right:6px;">&gt;</span>Confirm your email
            </h1>
            <p class="subtitle" style="margin:8px 0 0 0;color:{_MUTED};font-size:13px;font-family:{_MONO};">
                One click and you'll be subscribed to the ExploreYC daily digest.
            </p>
        </div>
        <div class="content" style="padding:24px 28px;font-family:{_MONO};">
            <p style="margin:0 0 14px 0;color:{_TEXT};font-size:14px;">
                ExploreYC tracks Y Combinator's directory daily — new launches, batch moves,
                and hiring activity — and ships you a digest only when there's something worth reading.
            </p>

            <div style="margin:18px 0 22px 0;border:1px solid {_BORDER};border-left:2px solid {_ORANGE};padding:14px 16px;background:{_BG};border-radius:2px;">
                <p style="margin:0 0 8px 0;color:{_TEXT};font-size:13px;font-family:{_MONO};">
                    <span style="color:{_ORANGE};">&gt;</span> what you'll get
                </p>
                <p style="margin:0 0 4px 0;color:{_TEXT};font-size:13px;">
                    <span style="color:{_ORANGE};">·</span> new YC companies as they go live
                </p>
                <p style="margin:0 0 4px 0;color:{_TEXT};font-size:13px;">
                    <span style="color:{_ORANGE};">·</span> hiring alerts when companies open roles
                </p>
                <p style="margin:0;color:{_TEXT};font-size:13px;">
                    <span style="color:{_ORANGE};">·</span> batch moves and notable updates
                </p>
            </div>

            <p style="text-align:center;margin:24px 0 12px 0;">
                <a href="{verification_link}" class="button" style="display:inline-block;background:{_ORANGE};color:#ffffff;padding:12px 22px;text-decoration:none;font-family:{_MONO};font-weight:600;font-size:13px;border-radius:2px;">
                    Confirm email &rarr;
                </a>
            </p>
            <p style="margin:18px 0 6px 0;color:{_MUTED};font-size:12px;font-family:{_MONO};">
                Or paste this link into your browser:
            </p>
            <div class="code" style="font-family:{_MONO};background:{_BG};border:1px solid {_BORDER};padding:10px 12px;border-radius:2px;font-size:12px;color:{_TEXT};word-break:break-all;">
                {verification_link}
            </div>
        </div>
        <div class="footer" style="padding:20px 28px;border-top:1px solid {_BORDER};text-align:center;font-size:12px;color:{_MUTED};font-family:{_MONO};">
            ExploreYC &middot; <a href="{self.frontend_url}" style="color:{_ORANGE};text-decoration:none;">exploreyc.com</a>
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
        today = date.today().strftime("%Y-%m-%d")
        total = len(new_companies) + len(newly_hiring) + len(batch_changes)

        sections = []

        if new_companies:
            cards = "\n".join(self._render_company_card(c) for c in new_companies[:20])
            sections.append(self._render_section(
                f"new companies ({len(new_companies)})",
                cards,
            ))

        if newly_hiring:
            cards = "\n".join(self._render_company_card(c, force_hiring=True) for c in newly_hiring[:20])
            sections.append(self._render_section(
                f"now hiring ({len(newly_hiring)})",
                cards,
            ))

        if batch_changes:
            cards = "\n".join(self._render_batch_change_card(c) for c in batch_changes[:10])
            sections.append(self._render_section(
                f"batch updates ({len(batch_changes)})",
                cards,
            ))

        return f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ExploreYC daily digest</title>
    <style>{_base_styles()}</style>
</head>
<body style="margin:0;padding:0;background-color:{_BG};font-family:{_MONO};">
    <div class="container" style="max-width:600px;margin:32px auto;background:{_CARD_BG};border:1px solid {_BORDER};border-radius:2px;">
        <div class="accent" style="height:3px;background:{_ORANGE};"></div>
        <div class="header" style="padding:28px 28px 20px 28px;border-bottom:1px solid {_BORDER};">
            <p class="prompt" style="color:{_MUTED};font-size:12px;margin:0 0 10px 0;font-family:{_MONO};">
                <span style="color:{_ORANGE};">$</span> exploreyc digest --date={today}
            </p>
            <h1 class="title" style="margin:0;font-size:22px;font-weight:700;color:{_TEXT};font-family:{_MONO};">
                <span style="color:{_ORANGE};margin-right:6px;">&gt;</span>Daily digest
            </h1>
            <p class="subtitle" style="margin:8px 0 0 0;color:{_MUTED};font-size:13px;font-family:{_MONO};">
                {total} update{"s" if total != 1 else ""} &middot; {today}
            </p>
        </div>
        <div class="content" style="padding:24px 28px;font-family:{_MONO};">
            {"".join(sections)}
            <p style="text-align:center;margin:24px 0 4px 0;">
                <a href="{self.frontend_url}" class="button" style="display:inline-block;background:{_ORANGE};color:#ffffff;padding:12px 22px;text-decoration:none;font-family:{_MONO};font-weight:600;font-size:13px;border-radius:2px;">
                    Explore all companies &rarr;
                </a>
            </p>
        </div>
        <div class="footer" style="padding:20px 28px;border-top:1px solid {_BORDER};text-align:center;font-size:12px;color:{_MUTED};font-family:{_MONO};">
            ExploreYC &middot; <a href="{self.frontend_url}" style="color:{_ORANGE};text-decoration:none;">exploreyc.com</a><br>
            <a href="{unsubscribe_link}" style="color:{_MUTED};text-decoration:underline;">unsubscribe</a>
        </div>
    </div>
</body>
</html>
"""

    def _render_section(self, label: str, cards_html: str) -> str:
        """Render a digest section with a terminal-style heading"""
        return f"""
            <div class="section" style="margin:0 0 28px 0;">
                <h2 class="section-heading" style="margin:0 0 14px 0;font-size:15px;font-weight:700;color:{_TEXT};font-family:{_MONO};">
                    <span style="color:{_ORANGE};margin-right:6px;">&gt;</span>{label}
                </h2>
                {cards_html}
            </div>
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
        <p style="font-family:{_MONO};color:{_TEXT};margin:0 0 12px 0;">
            <strong>From:</strong> {html.escape(name or '(no name)')} &lt;{html.escape(email)}&gt;
        </p>
        <p style="font-family:{_MONO};color:{_TEXT};margin:0 0 8px 0;"><strong>Message:</strong></p>
        <p style="font-family:{_MONO};color:{_TEXT};margin:0;line-height:1.6;">{escaped_msg}</p>
        """
        try:
            params = {
                "from": self.from_email,
                "to": [to_email],
                "reply_to": email,
                "subject": subject,
                "html": f"<div style='font-family:{_MONO};background:{_BG};padding:20px;'>{body}</div>",
            }
            resend.Emails.send(params)
            logger.info(f"Contact form sent from {email}")
            return True
        except Exception as e:
            logger.error(f"Failed to send contact form: {e}")
            return False

    def _render_company_card(self, company: Dict, force_hiring: bool = False) -> str:
        """Render a single company card in email"""
        name = company.get("name", "Unknown")
        batch = company.get("batch", "")
        # Accept both legacy "one_liner" and current "description" keys so
        # callers that flatten change-log rows don't need to mirror the schema.
        one_liner = company.get("one_liner") or company.get("description") or ""
        website = company.get("website", "")
        slug = company.get("slug") or company.get("company_slug") or ""
        is_hiring = company.get("is_hiring") or force_hiring
        logo = company.get("logo") or company.get("small_logo_thumb_url") or ""

        badges = []
        if batch:
            badges.append(
                f'<span class="badge badge-batch" style="display:inline-block;padding:2px 8px;border-radius:2px;'
                f'font-size:11px;font-family:{_MONO};margin-right:6px;background:{_ORANGE};color:#fff;">{batch}</span>'
            )
        if is_hiring:
            badges.append(
                '<span class="badge badge-hiring" style="display:inline-block;padding:2px 8px;border-radius:2px;'
                f'font-size:11px;font-family:{_MONO};margin-right:6px;background:#10b981;color:#fff;">hiring</span>'
            )
        badges_html = "".join(badges)

        logo_html = ""
        if logo:
            logo_html = (
                f'<img src="{logo}" alt="{name} logo" width="40" height="40" '
                f'style="width:40px;height:40px;border-radius:2px;object-fit:cover;'
                f'margin-right:12px;float:left;border:1px solid {_BORDER};">'
            )

        links = []
        if self.frontend_url and slug:
            company_page_url = f"{self.frontend_url.rstrip('/')}/company/{slug}"
            links.append(
                f'<a href="{company_page_url}" class="company-link primary" '
                f'style="color:{_ORANGE};text-decoration:none;margin-right:10px;font-weight:600;">'
                f'view profile &rarr;</a>'
            )
        if website:
            links.append(
                f'<a href="{website}" class="company-link" '
                f'style="color:{_ORANGE};text-decoration:none;margin-right:10px;">website &rarr;</a>'
            )
        if slug:
            yc_url = f"https://www.ycombinator.com/companies/{slug}"
            links.append(
                f'<a href="{yc_url}" class="company-link" '
                f'style="color:{_ORANGE};text-decoration:none;margin-right:10px;">yc page &rarr;</a>'
            )
        links_html = "".join(links)

        desc_html = (
            f'<p class="company-desc" style="color:{_MUTED};font-size:13px;'
            f'margin:6px 0 8px 0;line-height:1.5;font-family:{_MONO};">{one_liner}</p>'
        ) if one_liner else ""

        return f"""
            <div class="company-card" style="border:1px solid {_BORDER};border-left:2px solid {_ORANGE};
                padding:14px 16px;margin:0 0 10px 0;border-radius:2px;background:{_CARD_BG};overflow:auto;">
                {logo_html}
                <div style="overflow:hidden;">
                    <div class="company-name" style="font-weight:700;color:{_TEXT};font-size:15px;
                        margin:0 0 4px 0;font-family:{_MONO};">{name}</div>
                    <div class="company-meta" style="margin:4px 0 8px 0;">{badges_html}</div>
                    {desc_html}
                    {f'<div class="company-links" style="font-size:12px;font-family:{_MONO};">{links_html}</div>' if links_html else ""}
                </div>
            </div>
        """

    def _render_batch_change_card(self, change: Dict) -> str:
        """Render a card for a batch-change event (old_batch -> new_batch)"""
        name = change.get("name", "Unknown")
        old_batch = change.get("old_batch") or change.get("old_value") or "?"
        new_batch = change.get("new_batch") or change.get("new_value") or "?"
        slug = change.get("slug") or change.get("company_slug") or ""

        link_html = ""
        if self.frontend_url and slug:
            company_page_url = f"{self.frontend_url.rstrip('/')}/company/{slug}"
            link_html = (
                f'<a href="{company_page_url}" class="company-link primary" '
                f'style="color:{_ORANGE};text-decoration:none;margin-right:10px;font-weight:600;'
                f'font-size:12px;font-family:{_MONO};">view profile &rarr;</a>'
            )

        return f"""
            <div class="company-card" style="border:1px solid {_BORDER};border-left:2px solid {_ORANGE};
                padding:14px 16px;margin:0 0 10px 0;border-radius:2px;background:{_CARD_BG};">
                <div class="company-name" style="font-weight:700;color:{_TEXT};font-size:15px;
                    margin:0 0 6px 0;font-family:{_MONO};">{name}</div>
                <div style="margin:4px 0 8px 0;">
                    <span class="badge badge-arrow" style="display:inline-block;padding:2px 8px;
                        border-radius:2px;font-size:11px;font-family:{_MONO};margin-right:6px;
                        background:{_BG};border:1px solid {_BORDER};color:{_TEXT};">{old_batch}</span>
                    <span style="color:{_MUTED};font-size:12px;font-family:{_MONO};">&rarr;</span>
                    <span class="badge badge-batch" style="display:inline-block;padding:2px 8px;
                        border-radius:2px;font-size:11px;font-family:{_MONO};margin:0 6px;
                        background:{_ORANGE};color:#fff;">{new_batch}</span>
                </div>
                {link_html}
            </div>
        """
