"""
Currency detection and handling utilities for job salaries
Infers currency based on job location or company location
"""

from typing import Optional, Dict


# Mapping of countries to their primary currency codes
COUNTRY_CURRENCY_MAP = {
    # Asia
    'India': 'INR',
    'Singapore': 'SGD',
    'China': 'CNY',
    'Japan': 'JPY',
    'South Korea': 'KRW',
    'Hong Kong': 'HKD',
    'Thailand': 'THB',
    'Vietnam': 'VND',
    'Philippines': 'PHP',
    'Indonesia': 'IDR',
    'Malaysia': 'MYR',
    'Pakistan': 'PKR',
    'Bangladesh': 'BDT',
    'Taiwan': 'TWD',

    # Europe
    'United Kingdom': 'GBP',
    'Germany': 'EUR',
    'France': 'EUR',
    'Italy': 'EUR',
    'Spain': 'EUR',
    'Netherlands': 'EUR',
    'Sweden': 'SEK',
    'Switzerland': 'CHF',
    'Poland': 'PLN',
    'Russia': 'RUB',
    'Ukraine': 'UAH',
    'Turkey': 'TRY',
    'Denmark': 'DKK',
    'Norway': 'NOK',
    'Ireland': 'EUR',
    'Belgium': 'EUR',
    'Austria': 'EUR',
    'Czech Republic': 'CZK',
    'Portugal': 'EUR',
    'Greece': 'EUR',
    'Finland': 'EUR',

    # Americas
    'United States': 'USD',
    'USA': 'USD',
    'Canada': 'CAD',
    'Mexico': 'MXN',
    'Brazil': 'BRL',
    'Argentina': 'ARS',
    'Chile': 'CLP',
    'Colombia': 'COP',
    'Peru': 'PEN',

    # Middle East
    'United Arab Emirates': 'AED',
    'Saudi Arabia': 'SAR',
    'Israel': 'ILS',
    'Qatar': 'QAR',
    'Kuwait': 'KWD',

    # Africa
    'South Africa': 'ZAR',
    'Egypt': 'EGP',
    'Nigeria': 'NGN',
    'Kenya': 'KES',

    # Oceania
    'Australia': 'AUD',
    'New Zealand': 'NZD',
}

# Mapping of common location substrings to currencies
LOCATION_CURRENCY_MAP = {
    # US states and regions
    'San Francisco': 'USD',
    'Los Angeles': 'USD',
    'New York': 'USD',
    'Boston': 'USD',
    'Seattle': 'USD',
    'Austin': 'USD',
    'Denver': 'USD',
    'Chicago': 'USD',
    'Miami': 'USD',

    # International cities
    'London': 'GBP',
    'Berlin': 'EUR',
    'Paris': 'EUR',
    'Amsterdam': 'EUR',
    'Tokyo': 'JPY',
    'Sydney': 'AUD',
    'Toronto': 'CAD',
    'Singapore': 'SGD',
    'Hong Kong': 'HKD',
    'Dubai': 'AED',
    'Mumbai': 'INR',
    'Delhi': 'INR',
    'Bangalore': 'INR',
    'Gurugram': 'INR',
    'São Paulo': 'BRL',
    'Mexico City': 'MXN',
    'Tel Aviv': 'ILS',
    'Moscow': 'RUB',
    'Istanbul': 'TRY',
    'Bangkok': 'THB',
    'Ho Chi Minh': 'VND',
    'Manila': 'PHP',
    'Kuala Lumpur': 'MYR',
    'Jakarta': 'IDR',
    'Cape Town': 'ZAR',
    'Cairo': 'EGP',
}


def infer_currency_from_location(location: Optional[str]) -> str:
    """
    Infer currency based on location string

    Args:
        location: Location string (e.g., "San Francisco, CA" or "Mumbai, India")

    Returns:
        Currency code (e.g., "USD", "INR", "GBP")
    """
    if not location:
        return 'USD'

    location = str(location).strip()

    # Check for exact country matches
    for country, currency in COUNTRY_CURRENCY_MAP.items():
        if country.lower() in location.lower():
            return currency

    # Check for city/location matches
    for loc, currency in LOCATION_CURRENCY_MAP.items():
        if loc.lower() in location.lower():
            return currency

    # Default to USD
    return 'USD'


def infer_currency_from_company_location(company: Dict) -> str:
    """
    Infer currency from company location or country

    Args:
        company: Company dict with 'location' and/or 'country' fields

    Returns:
        Currency code (e.g., "USD", "INR", "GBP")
    """
    # Try location first
    if company.get('location'):
        currency = infer_currency_from_location(company['location'])
        if currency != 'USD':  # If we found a non-USD match
            return currency

    # Try country
    if company.get('country'):
        country = str(company['country']).strip()
        if country in COUNTRY_CURRENCY_MAP:
            return COUNTRY_CURRENCY_MAP[country]

    # Default to USD
    return 'USD'


def infer_currency_from_job(job: Dict, company: Optional[Dict] = None) -> str:
    """
    Infer currency from job and optionally company information

    Priority:
    1. Job's pretty_location_or_remote
    2. Job's locations array
    3. Company's location
    4. Company's country
    5. Default to USD

    Args:
        job: Job dict with location information
        company: Optional company dict for fallback

    Returns:
        Currency code (e.g., "USD", "INR", "GBP")
    """
    # Try job's pretty location
    if job.get('pretty_location_or_remote'):
        currency = infer_currency_from_location(job['pretty_location_or_remote'])
        if currency != 'USD':
            return currency

    # Try first location from job's locations array
    if job.get('locations') and len(job['locations']) > 0:
        first_location = job['locations'][0]
        currency = infer_currency_from_location(first_location)
        if currency != 'USD':
            return currency

    # Fall back to company location
    if company:
        return infer_currency_from_company_location(company)

    # Default to USD
    return 'USD'


# Currency symbols and formatting
CURRENCY_SYMBOLS = {
    'USD': '$',
    'EUR': '€',
    'GBP': '£',
    'INR': '₹',
    'JPY': '¥',
    'CNY': '¥',
    'AUD': 'A$',
    'CAD': 'C$',
    'SGD': 'S$',
    'HKD': 'HK$',
    'CHF': 'CHF',
    'SEK': 'kr',
    'NOK': 'kr',
    'DKK': 'kr',
    'BRL': 'R$',
    'MXN': '$',
    'AED': 'د.إ',
    'SAR': 'ر.س',
    'ZAR': 'R',
    'KRW': '₩',
    'THB': '฿',
    'MYR': 'RM',
    'PHP': '₱',
    'VND': '₫',
    'IDR': 'Rp',
    'ILS': '₪',
    'TRY': '₺',
}


def get_currency_symbol(currency: str) -> str:
    """Get the currency symbol for a currency code"""
    return CURRENCY_SYMBOLS.get(currency, currency)
