"""
Enhanced Geocoding Database
Comprehensive city coordinates for YC company mapping
"""

EXTENDED_LOCATION_COORDS = {
    # United States - Major Tech Hubs
    'San Francisco': {'lat': 37.7749, 'lng': -122.4194, 'country': 'United States'},
    'SF': {'lat': 37.7749, 'lng': -122.4194, 'country': 'United States'},
    'Silicon Valley': {'lat': 37.3861, 'lng': -122.0839, 'country': 'United States'},
    'Palo Alto': {'lat': 37.4419, 'lng': -122.1430, 'country': 'United States'},
    'Mountain View': {'lat': 37.3861, 'lng': -122.0839, 'country': 'United States'},
    'Menlo Park': {'lat': 37.4530, 'lng': -122.1817, 'country': 'United States'},
    'Sunnyvale': {'lat': 37.3688, 'lng': -122.0363, 'country': 'United States'},
    'Santa Clara': {'lat': 37.3541, 'lng': -121.9552, 'country': 'United States'},
    'San Jose': {'lat': 37.3382, 'lng': -121.8863, 'country': 'United States'},
    'Oakland': {'lat': 37.8044, 'lng': -122.2712, 'country': 'United States'},
    'Berkeley': {'lat': 37.8715, 'lng': -122.2730, 'country': 'United States'},

    # Bay Area - Additional Cities
    'San Mateo': {'lat': 37.5630, 'lng': -122.3255, 'country': 'United States'},
    'Redwood City': {'lat': 37.4852, 'lng': -122.2364, 'country': 'United States'},
    'San Carlos': {'lat': 37.5071, 'lng': -122.2605, 'country': 'United States'},
    'Burlingame': {'lat': 37.5847, 'lng': -122.3661, 'country': 'United States'},
    'Cupertino': {'lat': 37.3230, 'lng': -122.0322, 'country': 'United States'},
    'Emeryville': {'lat': 37.8313, 'lng': -122.2852, 'country': 'United States'},
    'San Leandro': {'lat': 37.7249, 'lng': -122.1561, 'country': 'United States'},
    'Foster City': {'lat': 37.5585, 'lng': -122.2711, 'country': 'United States'},
    'Stanford': {'lat': 37.4275, 'lng': -122.1697, 'country': 'United States'},
    'Santa Monica': {'lat': 34.0195, 'lng': -118.4912, 'country': 'United States'},
    'Culver City': {'lat': 34.0211, 'lng': -118.3965, 'country': 'United States'},
    'El Segundo': {'lat': 33.9192, 'lng': -118.4165, 'country': 'United States'},
    'Irvine': {'lat': 33.6846, 'lng': -117.8265, 'country': 'United States'},

    # US - East Coast
    'New York': {'lat': 40.7128, 'lng': -74.0060, 'country': 'United States'},
    'NYC': {'lat': 40.7128, 'lng': -74.0060, 'country': 'United States'},
    'Brooklyn': {'lat': 40.6782, 'lng': -73.9442, 'country': 'United States'},
    'Manhattan': {'lat': 40.7831, 'lng': -73.9712, 'country': 'United States'},
    'Boston': {'lat': 42.3601, 'lng': -71.0589, 'country': 'United States'},
    'Cambridge': {'lat': 42.3736, 'lng': -71.1097, 'country': 'United States'},
    'Philadelphia': {'lat': 39.9526, 'lng': -75.1652, 'country': 'United States'},
    'Washington': {'lat': 38.9072, 'lng': -77.0369, 'country': 'United States'},
    'DC': {'lat': 38.9072, 'lng': -77.0369, 'country': 'United States'},
    'Miami': {'lat': 25.7617, 'lng': -80.1918, 'country': 'United States'},
    'Atlanta': {'lat': 33.7490, 'lng': -84.3880, 'country': 'United States'},
    'Pittsburgh': {'lat': 40.4406, 'lng': -79.9959, 'country': 'United States'},
    'Detroit': {'lat': 42.3314, 'lng': -83.0458, 'country': 'United States'},

    # US - West Coast
    'Seattle': {'lat': 47.6062, 'lng': -122.3321, 'country': 'United States'},
    'Bellevue': {'lat': 47.6101, 'lng': -122.2015, 'country': 'United States'},
    'Portland': {'lat': 45.5152, 'lng': -122.6784, 'country': 'United States'},
    'Los Angeles': {'lat': 34.0522, 'lng': -118.2437, 'country': 'United States'},
    'LA': {'lat': 34.0522, 'lng': -118.2437, 'country': 'United States'},
    'San Diego': {'lat': 32.7157, 'lng': -117.1611, 'country': 'United States'},

    # US - Central/South
    'Austin': {'lat': 30.2672, 'lng': -97.7431, 'country': 'United States'},
    'Dallas': {'lat': 32.7767, 'lng': -96.7970, 'country': 'United States'},
    'Houston': {'lat': 29.7604, 'lng': -95.3698, 'country': 'United States'},
    'Chicago': {'lat': 41.8781, 'lng': -87.6298, 'country': 'United States'},
    'Denver': {'lat': 39.7392, 'lng': -104.9903, 'country': 'United States'},
    'Boulder': {'lat': 40.0150, 'lng': -105.2705, 'country': 'United States'},
    'Phoenix': {'lat': 33.4484, 'lng': -112.0740, 'country': 'United States'},
    'Las Vegas': {'lat': 36.1699, 'lng': -115.1398, 'country': 'United States'},
    'Nashville': {'lat': 36.1627, 'lng': -86.7816, 'country': 'United States'},
    'Charlotte': {'lat': 35.2271, 'lng': -80.8431, 'country': 'United States'},
    'Raleigh': {'lat': 35.7796, 'lng': -78.6382, 'country': 'United States'},
    'Durham': {'lat': 35.9940, 'lng': -78.8986, 'country': 'United States'},
    'Ann Arbor': {'lat': 42.2808, 'lng': -83.7430, 'country': 'United States'},
    'Lehi': {'lat': 40.3916, 'lng': -111.8507, 'country': 'United States'},

    # Canada
    'Toronto': {'lat': 43.6532, 'lng': -79.3832, 'country': 'Canada'},
    'Vancouver': {'lat': 49.2827, 'lng': -123.1207, 'country': 'Canada'},
    'Montreal': {'lat': 45.5017, 'lng': -73.5673, 'country': 'Canada'},
    'Ottawa': {'lat': 45.4215, 'lng': -75.6972, 'country': 'Canada'},
    'Calgary': {'lat': 51.0447, 'lng': -114.0719, 'country': 'Canada'},
    'Waterloo': {'lat': 43.4643, 'lng': -80.5204, 'country': 'Canada'},
    'Kitchener': {'lat': 43.4516, 'lng': -80.4925, 'country': 'Canada'},

    # UK & Ireland
    'London': {'lat': 51.5074, 'lng': -0.1278, 'country': 'United Kingdom'},
    'Manchester': {'lat': 53.4808, 'lng': -2.2426, 'country': 'United Kingdom'},
    'Edinburgh': {'lat': 55.9533, 'lng': -3.1883, 'country': 'United Kingdom'},
    'Cambridge': {'lat': 52.2053, 'lng': 0.1218, 'country': 'United Kingdom'},
    'Oxford': {'lat': 51.7520, 'lng': -1.2577, 'country': 'United Kingdom'},
    'Dublin': {'lat': 53.3498, 'lng': -6.2603, 'country': 'Ireland'},

    # Germany
    'Berlin': {'lat': 52.5200, 'lng': 13.4050, 'country': 'Germany'},
    'Munich': {'lat': 48.1351, 'lng': 11.5820, 'country': 'Germany'},
    'Hamburg': {'lat': 53.5511, 'lng': 9.9937, 'country': 'Germany'},
    'Frankfurt': {'lat': 50.1109, 'lng': 8.6821, 'country': 'Germany'},
    'Cologne': {'lat': 50.9375, 'lng': 6.9603, 'country': 'Germany'},

    # France
    'Paris': {'lat': 48.8566, 'lng': 2.3522, 'country': 'France'},
    'Lyon': {'lat': 45.7640, 'lng': 4.8357, 'country': 'France'},
    'Marseille': {'lat': 43.2965, 'lng': 5.3698, 'country': 'France'},
    'Nice': {'lat': 43.7102, 'lng': 7.2620, 'country': 'France'},

    # Netherlands
    'Amsterdam': {'lat': 52.3676, 'lng': 4.9041, 'country': 'Netherlands'},
    'Rotterdam': {'lat': 51.9244, 'lng': 4.4777, 'country': 'Netherlands'},
    'The Hague': {'lat': 52.0705, 'lng': 4.3007, 'country': 'Netherlands'},

    # Nordic Countries
    'Stockholm': {'lat': 59.3293, 'lng': 18.0686, 'country': 'Sweden'},
    'Copenhagen': {'lat': 55.6761, 'lng': 12.5683, 'country': 'Denmark'},
    'Oslo': {'lat': 59.9139, 'lng': 10.7522, 'country': 'Norway'},
    'Helsinki': {'lat': 60.1699, 'lng': 24.9384, 'country': 'Finland'},
    'Reykjavik': {'lat': 64.1466, 'lng': -21.9426, 'country': 'Iceland'},

    # Southern Europe
    'Barcelona': {'lat': 41.3851, 'lng': 2.1734, 'country': 'Spain'},
    'Madrid': {'lat': 40.4168, 'lng': -3.7038, 'country': 'Spain'},
    'Valencia': {'lat': 39.4699, 'lng': -0.3763, 'country': 'Spain'},
    'Lisbon': {'lat': 38.7223, 'lng': -9.1393, 'country': 'Portugal'},
    'Porto': {'lat': 41.1579, 'lng': -8.6291, 'country': 'Portugal'},
    'Rome': {'lat': 41.9028, 'lng': 12.4964, 'country': 'Italy'},
    'Milan': {'lat': 45.4642, 'lng': 9.1900, 'country': 'Italy'},
    'Florence': {'lat': 43.7696, 'lng': 11.2558, 'country': 'Italy'},
    'Athens': {'lat': 37.9838, 'lng': 23.7275, 'country': 'Greece'},

    # Central/Eastern Europe
    'Vienna': {'lat': 48.2082, 'lng': 16.3738, 'country': 'Austria'},
    'Brussels': {'lat': 50.8503, 'lng': 4.3517, 'country': 'Belgium'},
    'Warsaw': {'lat': 52.2297, 'lng': 21.0122, 'country': 'Poland'},
    'Prague': {'lat': 50.0755, 'lng': 14.4378, 'country': 'Czech Republic'},
    'Budapest': {'lat': 47.4979, 'lng': 19.0402, 'country': 'Hungary'},
    'Zurich': {'lat': 47.3769, 'lng': 8.5417, 'country': 'Switzerland'},
    'Geneva': {'lat': 46.2044, 'lng': 6.1432, 'country': 'Switzerland'},

    # Asia - East
    'Singapore': {'lat': 1.3521, 'lng': 103.8198, 'country': 'Singapore'},
    'Tokyo': {'lat': 35.6762, 'lng': 139.6503, 'country': 'Japan'},
    'Osaka': {'lat': 34.6937, 'lng': 135.5023, 'country': 'Japan'},
    'Seoul': {'lat': 37.5665, 'lng': 126.9780, 'country': 'South Korea'},
    'Hong Kong': {'lat': 22.3193, 'lng': 114.1694, 'country': 'Hong Kong'},
    'Shanghai': {'lat': 31.2304, 'lng': 121.4737, 'country': 'China'},
    'Beijing': {'lat': 39.9042, 'lng': 116.4074, 'country': 'China'},
    'Shenzhen': {'lat': 22.5431, 'lng': 114.0579, 'country': 'China'},
    'Taipei': {'lat': 25.0330, 'lng': 121.5654, 'country': 'Taiwan'},

    # Asia - South & Southeast
    'Bangalore': {'lat': 12.9716, 'lng': 77.5946, 'country': 'India'},
    'Bengaluru': {'lat': 12.9716, 'lng': 77.5946, 'country': 'India'},  # Alternative spelling
    'Mumbai': {'lat': 19.0760, 'lng': 72.8777, 'country': 'India'},
    'Delhi': {'lat': 28.6139, 'lng': 77.2090, 'country': 'India'},
    'New Delhi': {'lat': 28.6139, 'lng': 77.2090, 'country': 'India'},
    'Hyderabad': {'lat': 17.3850, 'lng': 78.4867, 'country': 'India'},
    'Chennai': {'lat': 13.0827, 'lng': 80.2707, 'country': 'India'},
    'Pune': {'lat': 18.5204, 'lng': 73.8567, 'country': 'India'},
    'Gurugram': {'lat': 28.4595, 'lng': 77.0266, 'country': 'India'},
    'Gurgaon': {'lat': 28.4595, 'lng': 77.0266, 'country': 'India'},
    'Noida': {'lat': 28.5355, 'lng': 77.3910, 'country': 'India'},
    'Kolkata': {'lat': 22.5726, 'lng': 88.3639, 'country': 'India'},
    'Bangkok': {'lat': 13.7563, 'lng': 100.5018, 'country': 'Thailand'},
    'Kuala Lumpur': {'lat': 3.1390, 'lng': 101.6869, 'country': 'Malaysia'},
    'Jakarta': {'lat': -6.2088, 'lng': 106.8456, 'country': 'Indonesia'},
    'Manila': {'lat': 14.5995, 'lng': 120.9842, 'country': 'Philippines'},
    'Makati': {'lat': 14.5547, 'lng': 121.0244, 'country': 'Philippines'},
    'Ho Chi Minh': {'lat': 10.8231, 'lng': 106.6297, 'country': 'Vietnam'},

    # Middle East
    'Tel Aviv': {'lat': 32.0853, 'lng': 34.7818, 'country': 'Israel'},
    'Dubai': {'lat': 25.2048, 'lng': 55.2708, 'country': 'United Arab Emirates'},
    'Riyadh': {'lat': 24.7136, 'lng': 46.6753, 'country': 'Saudi Arabia'},

    # Australia & New Zealand
    'Sydney': {'lat': -33.8688, 'lng': 151.2093, 'country': 'Australia'},
    'Melbourne': {'lat': -37.8136, 'lng': 144.9631, 'country': 'Australia'},
    'Brisbane': {'lat': -27.4698, 'lng': 153.0251, 'country': 'Australia'},
    'Perth': {'lat': -31.9505, 'lng': 115.8605, 'country': 'Australia'},
    'Auckland': {'lat': -36.8485, 'lng': 174.7633, 'country': 'New Zealand'},

    # Latin America
    'São Paulo': {'lat': -23.5505, 'lng': -46.6333, 'country': 'Brazil'},
    'Rio de Janeiro': {'lat': -22.9068, 'lng': -43.1729, 'country': 'Brazil'},
    'Buenos Aires': {'lat': -34.6037, 'lng': -58.3816, 'country': 'Argentina'},
    'Mexico City': {'lat': 19.4326, 'lng': -99.1332, 'country': 'Mexico'},
    'Monterrey': {'lat': 25.6866, 'lng': -100.3161, 'country': 'Mexico'},
    'Santiago': {'lat': -33.4489, 'lng': -70.6693, 'country': 'Chile'},
    'Lima': {'lat': -12.0464, 'lng': -77.0428, 'country': 'Peru'},
    'Bogotá': {'lat': 4.7110, 'lng': -74.0721, 'country': 'Colombia'},

    # Africa
    'Cape Town': {'lat': -33.9249, 'lng': 18.4241, 'country': 'South Africa'},
    'Johannesburg': {'lat': -26.2041, 'lng': 28.0473, 'country': 'South Africa'},
    'Lagos': {'lat': 6.5244, 'lng': 3.3792, 'country': 'Nigeria'},
    'Nairobi': {'lat': -1.2864, 'lng': 36.8172, 'country': 'Kenya'},
    'Cairo': {'lat': 30.0444, 'lng': 31.2357, 'country': 'Egypt'},
    'Accra': {'lat': 5.6037, 'lng': -0.1870, 'country': 'Ghana'},

    # Remote/Distributed
    'Remote': {'lat': 37.7749, 'lng': -122.4194, 'country': 'Remote'},
    'Worldwide': {'lat': 37.7749, 'lng': -122.4194, 'country': 'Remote'},
    'Distributed': {'lat': 37.7749, 'lng': -122.4194, 'country': 'Remote'},
}
