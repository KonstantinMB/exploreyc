#!/usr/bin/env python3
"""
Quick test script to verify email configuration
Run: python3 test_email_setup.py
"""

import os
import sys

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from email_service import EmailService

def test_email_config():
    """Test if email service is properly configured"""

    print("🔍 Testing Email Configuration...\n")

    # Check if Resend is installed
    try:
        import resend
        print("✅ Resend package installed")
    except ImportError:
        print("❌ Resend package NOT installed")
        print("   Fix: pip install resend")
        return False

    # Check environment variables
    api_key = os.environ.get("RESEND_API_KEY")
    from_email = os.environ.get("RESEND_FROM_EMAIL")
    frontend_url = os.environ.get("FRONTEND_URL")
    cron_secret = os.environ.get("CRON_SECRET")

    print(f"\n📧 Email Configuration:")
    print(f"   RESEND_API_KEY: {'✅ Set' if api_key and not api_key.startswith('re_your') else '❌ NOT SET (placeholder value)'}")
    print(f"   RESEND_FROM_EMAIL: {from_email or '❌ NOT SET'}")
    print(f"   FRONTEND_URL: {frontend_url or '❌ NOT SET'}")
    print(f"   CRON_SECRET: {'✅ Set' if cron_secret else '❌ NOT SET'}")

    if not api_key or api_key.startswith('re_your'):
        print("\n⚠️  RESEND_API_KEY is not configured!")
        print("   1. Sign up at https://resend.com")
        print("   2. Get your API key")
        print("   3. Update .env file: RESEND_API_KEY=re_your_real_key")
        return False

    # Try to initialize email service
    print("\n🧪 Testing Email Service...")
    try:
        email_service = EmailService()
        print("✅ Email service initialized successfully")
    except Exception as e:
        print(f"❌ Failed to initialize email service: {e}")
        return False

    # Test sending a test email (if user provides email)
    test_email = input("\n📬 Enter your email to send a test verification email (or press Enter to skip): ").strip()

    if test_email:
        import secrets
        token = secrets.token_urlsafe(32)

        print(f"\n📤 Sending test verification email to {test_email}...")
        success = email_service.send_verification_email(test_email, token)

        if success:
            print("✅ Test email sent successfully!")
            print(f"   Check your inbox at {test_email}")
        else:
            print("❌ Failed to send test email")
            print("   Check backend logs for error details")
            return False

    print("\n✅ Email configuration looks good!")
    print("\nNext steps:")
    print("1. Set up cron scheduler (see SETUP_EMAIL_SCHEDULER.md)")
    print("2. Add GitHub secrets: BACKEND_URL and CRON_SECRET")
    print("3. Configure production env vars in Railway")

    return True

if __name__ == "__main__":
    # Load .env file
    try:
        from dotenv import load_dotenv
        load_dotenv()
    except ImportError:
        print("⚠️  python-dotenv not installed (pip install python-dotenv)")

    success = test_email_config()
    sys.exit(0 if success else 1)
