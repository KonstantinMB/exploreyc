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
    'Melbourne': 'AUD',
    'Toronto': 'CAD',
    'Vancouver': 'CAD',
    'Montreal': 'CAD',
    'Singapore': 'SGD',
    'Hong Kong': 'HKD',
    'Dubai': 'AED',
    'Abu Dhabi': 'AED',

    # Indian cities (expanded — many YC India hires are outside the big four)
    'Mumbai': 'INR',
    'Delhi': 'INR',
    'New Delhi': 'INR',
    'Bangalore': 'INR',
    'Bengaluru': 'INR',
    'Gurugram': 'INR',
    'Gurgaon': 'INR',
    'Noida': 'INR',
    'Pune': 'INR',
    'Hyderabad': 'INR',
    'Chennai': 'INR',
    'Kolkata': 'INR',
    'Ahmedabad': 'INR',
    'Jaipur': 'INR',
    'Chandigarh': 'INR',
    'Kochi': 'INR',
    'Indore': 'INR',
    'Surat': 'INR',
    'Coimbatore': 'INR',
    'Lucknow': 'INR',
    'Bhubaneswar': 'INR',

    'São Paulo': 'BRL',
    'Sao Paulo': 'BRL',
    'Rio de Janeiro': 'BRL',
    'Mexico City': 'MXN',
    'Tel Aviv': 'ILS',
    'Moscow': 'RUB',
    'Istanbul': 'TRY',
    'Bangkok': 'THB',
    'Ho Chi Minh': 'VND',
    'Hanoi': 'VND',
    'Manila': 'PHP',
    'Kuala Lumpur': 'MYR',
    'Jakarta': 'IDR',
    'Cape Town': 'ZAR',
    'Johannesburg': 'ZAR',
    'Cairo': 'EGP',
    'Lagos': 'NGN',
    'Nairobi': 'KES',
    'Seoul': 'KRW',
    'Taipei': 'TWD',
    'Karachi': 'PKR',
    'Lahore': 'PKR',
    'Islamabad': 'PKR',
    'Dhaka': 'BDT',
    'Buenos Aires': 'ARS',
    'Santiago': 'CLP',
    'Bogotá': 'COP',
    'Bogota': 'COP',
    'Lima': 'PEN',
    'Warsaw': 'PLN',
    'Prague': 'CZK',
    'Zurich': 'CHF',
    'Geneva': 'CHF',
    'Stockholm': 'SEK',
    'Copenhagen': 'DKK',
    'Oslo': 'NOK',
    'Auckland': 'NZD',
    'Wellington': 'NZD',
}


# In-memory USD exchange rates.
# Values are "1 unit of <CCY> in USD" — multiply a local-currency salary by
# the rate to get USD. Snapshot rates (rounded), not live; intentional
# trade-off so analytics aren't blocked on an FX API. Refresh every few
# months if rates drift materially.
EXCHANGE_RATES: Dict[str, float] = {
    'USD': 1.0,
    'EUR': 1.08,
    'GBP': 1.27,
    'CHF': 1.12,
    'CAD': 0.74,
    'AUD': 0.66,
    'NZD': 0.61,
    'SEK': 0.094,
    'NOK': 0.092,
    'DKK': 0.145,
    'PLN': 0.25,
    'CZK': 0.043,
    'RUB': 0.011,
    'UAH': 0.024,
    'TRY': 0.029,

    # Asia
    'INR': 0.012,
    'CNY': 0.14,
    'JPY': 0.0067,
    'KRW': 0.00073,
    'HKD': 0.13,
    'SGD': 0.74,
    'TWD': 0.031,
    'THB': 0.029,
    'VND': 0.000040,
    'PHP': 0.018,
    'MYR': 0.22,
    'IDR': 0.000064,
    'PKR': 0.0036,
    'BDT': 0.0084,

    # Middle East
    'AED': 0.27,
    'SAR': 0.27,
    'ILS': 0.27,
    'QAR': 0.27,
    'KWD': 3.25,

    # Africa
    'ZAR': 0.054,
    'EGP': 0.020,
    'NGN': 0.00065,
    'KES': 0.0077,

    # Latin America
    'MXN': 0.058,
    'BRL': 0.20,
    'ARS': 0.0010,
    'CLP': 0.0011,
    'COP': 0.00024,
    'PEN': 0.27,
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


def convert_to_usd(amount: Optional[float], currency: Optional[str]) -> Optional[float]:
    """Convert an amount from `currency` to USD using static EXCHANGE_RATES."""
    if amount is None:
        return None
    if not currency:
        return amount
    rate = EXCHANGE_RATES.get(currency.upper())
    if rate is None:
        # Unknown currency — return as-is rather than zeroing it out.
        return amount
    return amount * rate


def job_salary_to_usd(job: Dict, company: Optional[Dict] = None) -> Optional[float]:
    """Get a job's mid-point salary in USD, or None if no salary data.

    Combines currency inference (from job/company location) with conversion,
    so analytics can include non-USD jobs after normalizing.
    """
    min_sal = job.get("salary_min")
    max_sal = job.get("salary_max")

    if min_sal and max_sal:
        local = (min_sal + max_sal) / 2
    elif min_sal:
        local = min_sal
    elif max_sal:
        local = max_sal
    else:
        return None

    currency = infer_currency_from_job(job, company)
    return convert_to_usd(local, currency)
