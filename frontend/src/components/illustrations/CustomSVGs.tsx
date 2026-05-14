// Custom YC-themed SVG illustrations

interface SVGProps {
  className?: string;
  color?: string;
}

// Official YC Logo Component
export const YCLogo = ({ className = "w-12 h-12", color = "#FB651E" }: SVGProps) => (
  <svg className={className} viewBox="0 0 1280 1280" xmlns="http://www.w3.org/2000/svg">
    <path fill={color} d="M627.000000,1281.000000 C418.000000,1281.000000 209.500000,1281.000000 1.000000,1281.000000 C1.000000,854.333313 1.000000,427.666656 1.000000,1.000000 C427.666656,1.000000 854.333313,1.000000 1281.000000,1.000000 C1281.000000,427.666656 1281.000000,854.333313 1281.000000,1281.000000 C1063.166626,1281.000000 845.333313,1281.000000 627.000000,1281.000000 M902.037903,313.110229 C873.043396,313.098969 844.048645,313.144196 815.054810,312.998718 C811.754456,312.982147 810.117737,313.971313 808.622437,316.975433 C754.135742,426.442963 699.542419,535.857422 644.955994,645.275330 C644.304993,646.580261 643.552307,647.834534 642.707825,649.364624 C642.243164,648.618103 641.957581,648.254089 641.770325,647.845032 C631.470154,625.339294 621.714111,602.566162 610.791199,580.367126 C567.465027,492.313812 523.761108,404.446381 480.282410,316.467896 C478.971436,313.815155 477.432648,313.008728 474.585419,313.017517 C443.923401,313.112396 413.260986,313.072052 382.598663,313.094421 C381.393097,313.095306 380.187714,313.354279 378.531769,313.544830 C379.532837,315.531982 380.239929,317.007629 381.008636,318.450439 C389.684235,334.733917 398.365112,351.014648 407.052551,367.291840 C430.783142,411.754608 454.515594,456.216400 478.250824,500.676727 C517.345825,573.908569 556.466248,647.126831 595.452698,720.416443 C596.932556,723.198364 597.816406,726.662781 597.821045,729.810791 C597.946533,816.131653 597.921387,902.452820 597.921387,988.773865 C597.921387,990.723267 597.921387,992.672668 597.921387,994.697876 C626.319641,994.697876 654.192932,994.697876 682.297791,994.697876 C682.297791,992.158203 682.297791,989.997375 682.297791,987.836548 C682.297791,903.515198 682.272095,819.193787 682.398193,734.872620 C682.402954,731.719177 683.343628,728.295776 684.771667,725.463867 C690.305786,714.489624 696.208130,703.700928 701.983765,692.848755 C734.964966,630.878052 767.947021,568.907776 800.932861,506.939514 C825.170959,461.405090 849.441650,415.888000 873.644104,370.334656 C883.552734,351.684845 893.320129,332.959991 903.545349,314.018524 C903.349304,313.769958 903.153259,313.521362 902.037903,313.110229 z"/>
    <path fill="#FFFFFF" d="M903.151794,314.269287 C893.320129,332.959991 883.552734,351.684845 873.644104,370.334656 C849.441650,415.888000 825.170959,461.405090 800.932861,506.939514 C767.947021,568.907776 734.964966,630.878052 701.983765,692.848755 C696.208130,703.700928 690.305786,714.489624 684.771667,725.463867 C683.343628,728.295776 682.402954,731.719177 682.398193,734.872620 C682.272095,819.193787 682.297791,903.515198 682.297791,987.836548 C682.297791,989.997375 682.297791,992.158203 682.297791,994.697876 C654.192932,994.697876 626.319641,994.697876 597.921387,994.697876 C597.921387,992.672668 597.921387,990.723267 597.921387,988.773865 C597.921387,902.452820 597.946533,816.131653 597.821045,729.810791 C597.816406,726.662781 596.932556,723.198364 595.452698,720.416443 C556.466248,647.126831 517.345825,573.908569 478.250824,500.676727 C454.515594,456.216400 430.783142,411.754608 407.052551,367.291840 C398.365112,351.014648 389.684235,334.733917 381.008636,318.450439 C380.239929,317.007629 379.532837,315.531982 378.531769,313.544830 C380.187714,313.354279 381.393097,313.095306 382.598663,313.094421 C413.260986,313.072052 443.923401,313.112396 474.585419,313.017517 C477.432648,313.008728 478.971436,313.815155 480.282410,316.467896 C523.761108,404.446381 567.465027,492.313812 610.791199,580.367126 C621.714111,602.566162 631.470154,625.339294 641.770325,647.845032 C641.957581,648.254089 642.243164,648.618103 642.707825,649.364624 C643.552307,647.834534 644.304993,646.580261 644.955994,645.275330 C699.542419,535.857422 754.135742,426.442963 808.622437,316.975433 C810.117737,313.971313 811.754456,312.982147 815.054810,312.998718 C844.048645,313.144196 873.043396,313.098969 902.520813,313.445587 C903.053101,313.943726 903.102417,314.106506 903.151794,314.269287 z"/>
  </svg>
);

// YC Hero Banner - improved layout with better spacing
export const YCHeroBanner = ({ className = "w-full h-32" }: SVGProps) => (
  <svg className={className} viewBox="0 0 1200 180" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
    {/* Background gradient */}
    <defs>
      <linearGradient id="heroGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FB651E" stopOpacity="0.08"/>
        <stop offset="50%" stopColor="#FF6600" stopOpacity="0.04"/>
        <stop offset="100%" stopColor="#FB651E" stopOpacity="0.08"/>
      </linearGradient>
    </defs>
    <rect width="1200" height="180" fill="url(#heroGradient)" rx="8"/>

    {/* Startup city skyline - lower and more spaced */}
    <g opacity="0.15">
      <rect x="50" y="110" width="25" height="70" fill="#FB651E" rx="2"/>
      <rect x="90" y="95" width="30" height="85" fill="#FB651E" rx="2"/>
      <rect x="135" y="105" width="23" height="75" fill="#FB651E" rx="2"/>
      <rect x="173" y="90" width="33" height="90" fill="#FB651E" rx="2"/>

      <rect x="950" y="100" width="28" height="80" fill="#FB651E" rx="2"/>
      <rect x="993" y="95" width="30" height="85" fill="#FB651E" rx="2"/>
      <rect x="1038" y="105" width="25" height="75" fill="#FB651E" rx="2"/>
      <rect x="1078" y="90" width="32" height="90" fill="#FB651E" rx="2"/>
      <rect x="1125" y="100" width="25" height="80" fill="#FB651E" rx="2"/>
    </g>

    {/* YC Logo on left */}
    <g transform="translate(60, 50)">
      <rect width="60" height="60" fill="#FB651E" rx="4"/>
      <path fill="#FFFFFF" transform="scale(0.047) translate(0, 50)" d="M903.151794,314.269287 C893.320129,332.959991 883.552734,351.684845 873.644104,370.334656 C849.441650,415.888000 825.170959,461.405090 800.932861,506.939514 C767.947021,568.907776 734.964966,630.878052 701.983765,692.848755 C696.208130,703.700928 690.305786,714.489624 684.771667,725.463867 C683.343628,728.295776 682.402954,731.719177 682.398193,734.872620 C682.272095,819.193787 682.297791,903.515198 682.297791,987.836548 C682.297791,989.997375 682.297791,992.158203 682.297791,994.697876 C654.192932,994.697876 626.319641,994.697876 597.921387,994.697876 C597.921387,992.672668 597.921387,990.723267 597.921387,988.773865 C597.921387,902.452820 597.946533,816.131653 597.821045,729.810791 C597.816406,726.662781 596.932556,723.198364 595.452698,720.416443 C556.466248,647.126831 517.345825,573.908569 478.250824,500.676727 C454.515594,456.216400 430.783142,411.754608 407.052551,367.291840 C398.365112,351.014648 389.684235,334.733917 381.008636,318.450439 C380.239929,317.007629 379.532837,315.531982 378.531769,313.544830 C380.187714,313.354279 381.393097,313.095306 382.598663,313.094421 C413.260986,313.072052 443.923401,313.112396 474.585419,313.017517 C477.432648,313.008728 478.971436,313.815155 480.282410,316.467896 C523.761108,404.446381 567.465027,492.313812 610.791199,580.367126 C621.714111,602.566162 631.470154,625.339294 641.770325,647.845032 C641.957581,648.254089 642.243164,648.618103 642.707825,649.364624 C643.552307,647.834534 644.304993,646.580261 644.955994,645.275330 C699.542419,535.857422 754.135742,426.442963 808.622437,316.975433 C810.117737,313.971313 811.754456,312.982147 815.054810,312.998718 C844.048645,313.144196 873.043396,313.098969 902.520813,313.445587 C903.053101,313.943726 903.102417,314.106506 903.151794,314.269287 z"/>
    </g>

    {/* Title and subtitle - better positioned */}
    <text x="600" y="70" fontSize="36" fill="#FB651E" textAnchor="middle" fontWeight="700" letterSpacing="0.5">
      Y Combinator Explorer
    </text>
    <text x="600" y="105" fontSize="15" fill="#FB651E" textAnchor="middle" opacity="0.7" fontFamily="'JetBrains Mono', monospace" letterSpacing="1">
      5,772 companies • 20 years of innovation • Global startup data
    </text>

    {/* Decorative elements - connection lines */}
    <g opacity="0.2">
      <circle cx="250" cy="40" r="3" fill="#FB651E"/>
      <circle cx="450" cy="35" r="3" fill="#FB651E"/>
      <circle cx="750" cy="35" r="3" fill="#FB651E"/>
      <circle cx="950" cy="40" r="3" fill="#FB651E"/>
      <line x1="250" y1="40" x2="450" y2="35" stroke="#FB651E" strokeWidth="1" strokeDasharray="4 4"/>
      <line x1="450" y1="35" x2="750" y2="35" stroke="#FB651E" strokeWidth="1" strokeDasharray="4 4"/>
      <line x1="750" y1="35" x2="950" y2="40" stroke="#FB651E" strokeWidth="1" strokeDasharray="4 4"/>
    </g>

    {/* Rocket icons */}
    <g opacity="0.3">
      <path d="M 280 130 L 285 145 L 285 152 L 280 155 L 275 152 L 275 145 Z" fill="#FB651E"/>
      <path d="M 600 125 L 605 140 L 605 147 L 600 150 L 595 147 L 595 140 Z" fill="#4CAF50"/>
      <path d="M 920 130 L 925 145 L 925 152 L 920 155 L 915 152 L 915 145 Z" fill="#2196F3"/>
    </g>
  </svg>
);

// Startup Building Icon - represents total companies
export const StartupBuildingSVG = ({ className = "w-12 h-12", color = "#FB651E" }: SVGProps) => (
  <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Building base */}
    <rect x="20" y="30" width="60" height="60" fill={color} opacity="0.1" rx="4"/>
    <rect x="20" y="30" width="60" height="60" stroke={color} strokeWidth="2" rx="4"/>

    {/* Windows */}
    <rect x="28" y="38" width="8" height="8" fill={color} opacity="0.6" rx="1"/>
    <rect x="46" y="38" width="8" height="8" fill={color} opacity="0.6" rx="1"/>
    <rect x="64" y="38" width="8" height="8" fill={color} opacity="0.6" rx="1"/>

    <rect x="28" y="52" width="8" height="8" fill={color} opacity="0.6" rx="1"/>
    <rect x="46" y="52" width="8" height="8" fill={color} opacity="0.6" rx="1"/>
    <rect x="64" y="52" width="8" height="8" fill={color} opacity="0.6" rx="1"/>

    <rect x="28" y="66" width="8" height="8" fill={color} opacity="0.6" rx="1"/>
    <rect x="46" y="66" width="8" height="8" fill={color} opacity="0.6" rx="1"/>
    <rect x="64" y="66" width="8" height="8" fill={color} opacity="0.6" rx="1"/>

    {/* Door */}
    <rect x="42" y="78" width="16" height="12" fill={color} rx="1"/>

    {/* Roof flag with YC logo */}
    <line x1="50" y1="30" x2="50" y2="12" stroke={color} strokeWidth="2"/>

    {/* YC logo badge at top */}
    <g transform="translate(7, 17)">
      <rect width="16" height="16" fill={color} rx="2"/>
      <path fill="#FFFFFF" transform="scale(0.0125)" d="M903.151794,314.269287 C893.320129,332.959991 883.552734,351.684845 873.644104,370.334656 C849.441650,415.888000 825.170959,461.405090 800.932861,506.939514 C767.947021,568.907776 734.964966,630.878052 701.983765,692.848755 C696.208130,703.700928 690.305786,714.489624 684.771667,725.463867 C683.343628,728.295776 682.402954,731.719177 682.398193,734.872620 C682.272095,819.193787 682.297791,903.515198 682.297791,987.836548 C682.297791,989.997375 682.297791,992.158203 682.297791,994.697876 C654.192932,994.697876 626.319641,994.697876 597.921387,994.697876 C597.921387,992.672668 597.921387,990.723267 597.921387,988.773865 C597.921387,902.452820 597.946533,816.131653 597.821045,729.810791 C597.816406,726.662781 596.932556,723.198364 595.452698,720.416443 C556.466248,647.126831 517.345825,573.908569 478.250824,500.676727 C454.515594,456.216400 430.783142,411.754608 407.052551,367.291840 C398.365112,351.014648 389.684235,334.733917 381.008636,318.450439 C380.239929,317.007629 379.532837,315.531982 378.531769,313.544830 C380.187714,313.354279 381.393097,313.095306 382.598663,313.094421 C413.260986,313.072052 443.923401,313.112396 474.585419,313.017517 C477.432648,313.008728 478.971436,313.815155 480.282410,316.467896 C523.761108,404.446381 567.465027,492.313812 610.791199,580.367126 C621.714111,602.566162 631.470154,625.339294 641.770325,647.845032 C641.957581,648.254089 642.243164,648.618103 642.707825,649.364624 C643.552307,647.834534 644.304993,646.580261 644.955994,645.275330 C699.542419,535.857422 754.135742,426.442963 808.622437,316.975433 C810.117737,313.971313 811.754456,312.982147 815.054810,312.998718 C844.048645,313.144196 873.043396,313.098969 902.520813,313.445587 C903.053101,313.943726 903.102417,314.106506 903.151794,314.269287 z"/>
    </g>
  </svg>
);

// Hiring Magnet Icon - represents hiring companies
export const HiringMagnetSVG = ({ className = "w-12 h-12", color = "#4CAF50" }: SVGProps) => (
  <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Magnet U-shape */}
    <path
      d="M 25 30 L 25 50 Q 25 75 50 75 Q 75 75 75 50 L 75 30"
      stroke={color}
      strokeWidth="8"
      fill="none"
      strokeLinecap="round"
    />
    <rect x="20" y="25" width="15" height="20" fill={color} rx="2"/>
    <rect x="65" y="25" width="15" height="20" fill={color} rx="2"/>

    {/* Magnetic field lines */}
    <circle cx="50" cy="75" r="3" fill={color} opacity="0.6"/>
    <circle cx="40" cy="78" r="2" fill={color} opacity="0.4"/>
    <circle cx="60" cy="78" r="2" fill={color} opacity="0.4"/>
    <circle cx="35" cy="72" r="1.5" fill={color} opacity="0.3"/>
    <circle cx="65" cy="72" r="1.5" fill={color} opacity="0.3"/>

    {/* Person icons being attracted */}
    <circle cx="30" cy="10" r="3" fill={color} opacity="0.7"/>
    <line x1="30" y1="13" x2="30" y2="18" stroke={color} strokeWidth="1.5" opacity="0.7"/>

    <circle cx="50" cy="8" r="3" fill={color} opacity="0.7"/>
    <line x1="50" y1="11" x2="50" y2="16" stroke={color} strokeWidth="1.5" opacity="0.7"/>

    <circle cx="70" cy="10" r="3" fill={color} opacity="0.7"/>
    <line x1="70" y1="13" x2="70" y2="18" stroke={color} strokeWidth="1.5" opacity="0.7"/>
  </svg>
);

// Growth Rocket Icon - represents top batch/trending
export const GrowthRocketSVG = ({ className = "w-12 h-12", color = "#2196F3" }: SVGProps) => (
  <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Rocket body */}
    <path d="M 50 15 L 60 45 L 60 70 L 50 75 L 40 70 L 40 45 Z" fill={color} opacity="0.2"/>
    <path d="M 50 15 L 60 45 L 60 70 L 50 75 L 40 70 L 40 45 Z" stroke={color} strokeWidth="2"/>

    {/* Rocket nose cone */}
    <path d="M 40 45 Q 50 20 60 45" fill={color}/>

    {/* Window */}
    <circle cx="50" cy="50" r="6" fill="white" opacity="0.9"/>
    <circle cx="50" cy="50" r="4" fill={color} opacity="0.4"/>

    {/* Fins */}
    <path d="M 40 60 L 30 75 L 40 70 Z" fill={color}/>
    <path d="M 60 60 L 70 75 L 60 70 Z" fill={color}/>

    {/* Flames */}
    <path d="M 45 75 Q 45 85 50 88 Q 55 85 55 75" fill="#FFC107"/>
    <path d="M 47 76 Q 47 82 50 84 Q 53 82 53 76" fill="#FF6600"/>

    {/* Trend line in background */}
    <path d="M 15 85 L 30 75 L 45 70 L 60 60 L 75 45" stroke={color} strokeWidth="1.5" strokeDasharray="3 2" opacity="0.4"/>
    <circle cx="75" cy="45" r="2" fill={color} opacity="0.4"/>
  </svg>
);

// Global Network Icon - represents top region/countries
export const GlobalNetworkSVG = ({ className = "w-12 h-12", color = "#FFC107" }: SVGProps) => (
  <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Globe circle */}
    <circle cx="50" cy="50" r="35" fill={color} opacity="0.1"/>
    <circle cx="50" cy="50" r="35" stroke={color} strokeWidth="2"/>

    {/* Latitude lines */}
    <ellipse cx="50" cy="50" rx="35" ry="12" stroke={color} strokeWidth="1" opacity="0.4"/>
    <ellipse cx="50" cy="50" rx="35" ry="24" stroke={color} strokeWidth="1" opacity="0.4"/>

    {/* Longitude lines */}
    <ellipse cx="50" cy="50" rx="12" ry="35" stroke={color} strokeWidth="1" opacity="0.4"/>
    <ellipse cx="50" cy="50" rx="24" ry="35" stroke={color} strokeWidth="1" opacity="0.4"/>

    {/* Network nodes - representing YC companies globally */}
    <circle cx="35" cy="35" r="3" fill={color}/>
    <circle cx="65" cy="35" r="3" fill={color}/>
    <circle cx="30" cy="55" r="3" fill={color}/>
    <circle cx="50" cy="65" r="3" fill={color}/>
    <circle cx="70" cy="55" r="3" fill={color}/>

    {/* Connection lines */}
    <line x1="35" y1="35" x2="65" y2="35" stroke={color} strokeWidth="1" opacity="0.3"/>
    <line x1="35" y1="35" x2="30" y2="55" stroke={color} strokeWidth="1" opacity="0.3"/>
    <line x1="65" y1="35" x2="70" y2="55" stroke={color} strokeWidth="1" opacity="0.3"/>
    <line x1="30" y1="55" x2="50" y2="65" stroke={color} strokeWidth="1" opacity="0.3"/>
    <line x1="70" y1="55" x2="50" y2="65" stroke={color} strokeWidth="1" opacity="0.3"/>
  </svg>
);

// Analytics Chart Icon - for analytics section header
export const AnalyticsChartSVG = ({ className = "w-16 h-16", color = "#FF6600" }: SVGProps) => (
  <svg className={className} viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Chart container */}
    <rect x="10" y="10" width="100" height="100" fill={color} opacity="0.05" rx="8"/>
    <rect x="10" y="10" width="100" height="100" stroke={color} strokeWidth="2" rx="8" opacity="0.3"/>

    {/* Bar chart */}
    <rect x="20" y="70" width="12" height="30" fill={color} opacity="0.6" rx="2"/>
    <rect x="38" y="55" width="12" height="45" fill={color} opacity="0.7" rx="2"/>
    <rect x="56" y="45" width="12" height="55" fill={color} opacity="0.8" rx="2"/>
    <rect x="74" y="35" width="12" height="65" fill={color} rx="2"/>

    {/* Trend line overlay */}
    <path d="M 26 75 L 44 60 L 62 50 L 80 40" stroke="#4CAF50" strokeWidth="2" strokeLinecap="round"/>
    <circle cx="26" cy="75" r="3" fill="#4CAF50"/>
    <circle cx="44" cy="60" r="3" fill="#4CAF50"/>
    <circle cx="62" cy="50" r="3" fill="#4CAF50"/>
    <circle cx="80" cy="40" r="3" fill="#4CAF50"/>

    {/* YC badge */}
    <circle cx="95" cy="25" r="10" fill={color}/>
    <text x="95" y="28" fontSize="8" fill="white" textAnchor="middle" fontWeight="bold">YC</text>
  </svg>
);

// Data Insights Icon - for insights section
export const DataInsightsSVG = ({ className = "w-16 h-16", color = "#FF6600" }: SVGProps) => (
  <svg className={className} viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Brain/lightbulb hybrid */}
    <circle cx="60" cy="60" r="35" fill={color} opacity="0.1"/>

    {/* Brain curves */}
    <path d="M 40 45 Q 35 55 40 65 Q 45 70 50 65 Q 55 60 50 55 Q 45 50 40 45"
          stroke={color} strokeWidth="2" fill="none"/>
    <path d="M 80 45 Q 85 55 80 65 Q 75 70 70 65 Q 65 60 70 55 Q 75 50 80 45"
          stroke={color} strokeWidth="2" fill="none"/>
    <path d="M 50 55 Q 60 50 70 55" stroke={color} strokeWidth="2" fill="none"/>

    {/* Data points */}
    <circle cx="45" cy="55" r="2" fill={color}/>
    <circle cx="60" cy="52" r="2" fill={color}/>
    <circle cx="75" cy="55" r="2" fill={color}/>
    <circle cx="50" cy="65" r="2" fill={color}/>
    <circle cx="70" cy="65" r="2" fill={color}/>

    {/* Connection lines */}
    <line x1="45" y1="55" x2="60" y2="52" stroke={color} strokeWidth="1" opacity="0.3"/>
    <line x1="60" y1="52" x2="75" y2="55" stroke={color} strokeWidth="1" opacity="0.3"/>
    <line x1="50" y1="65" x2="70" y2="65" stroke={color} strokeWidth="1" opacity="0.3"/>

    {/* Lightbulb filament */}
    <path d="M 55 75 L 60 70 L 65 75" stroke={color} strokeWidth="1.5"/>

    {/* Rays of insight */}
    <line x1="25" y1="35" x2="30" y2="40" stroke={color} strokeWidth="2" strokeLinecap="round"/>
    <line x1="25" y1="60" x2="30" y2="60" stroke={color} strokeWidth="2" strokeLinecap="round"/>
    <line x1="25" y1="85" x2="30" y2="80" stroke={color} strokeWidth="2" strokeLinecap="round"/>

    <line x1="95" y1="35" x2="90" y2="40" stroke={color} strokeWidth="2" strokeLinecap="round"/>
    <line x1="95" y1="60" x2="90" y2="60" stroke={color} strokeWidth="2" strokeLinecap="round"/>
    <line x1="95" y1="85" x2="90" y2="80" stroke={color} strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

// Map Location Icon - for map section
export const MapLocationSVG = ({ className = "w-16 h-16", color = "#FF6600" }: SVGProps) => (
  <svg className={className} viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Map background */}
    <rect x="15" y="20" width="90" height="80" fill={color} opacity="0.05" rx="4"/>
    <rect x="15" y="20" width="90" height="80" stroke={color} strokeWidth="2" rx="4" opacity="0.3"/>

    {/* Map fold lines */}
    <line x1="45" y1="20" x2="45" y2="100" stroke={color} strokeWidth="1" opacity="0.2" strokeDasharray="4 4"/>
    <line x1="75" y1="20" x2="75" y2="100" stroke={color} strokeWidth="1" opacity="0.2" strokeDasharray="4 4"/>

    {/* Location pins */}
    <g>
      {/* Pin 1 */}
      <path d="M 35 45 Q 35 35 40 35 Q 45 35 45 45 Q 45 55 40 65 Q 35 55 35 45" fill={color} opacity="0.7"/>
      <circle cx="40" cy="42" r="3" fill="white"/>
    </g>

    <g>
      {/* Pin 2 */}
      <path d="M 55 60 Q 55 50 60 50 Q 65 50 65 60 Q 65 70 60 80 Q 55 70 55 60" fill="#4CAF50"/>
      <circle cx="60" cy="57" r="3" fill="white"/>
    </g>

    <g>
      {/* Pin 3 */}
      <path d="M 80 40 Q 80 30 85 30 Q 90 30 90 40 Q 90 50 85 60 Q 80 50 80 40" fill="#2196F3" opacity="0.7"/>
      <circle cx="85" cy="37" r="3" fill="white"/>
    </g>

    {/* Route lines */}
    <path d="M 40 65 Q 50 70 60 80" stroke={color} strokeWidth="1.5" strokeDasharray="3 3" opacity="0.3"/>
    <path d="M 60 80 Q 70 65 85 60" stroke={color} strokeWidth="1.5" strokeDasharray="3 3" opacity="0.3"/>
  </svg>
);

// Companies Browser Icon - for companies section
export const CompanyGridSVG = ({ className = "w-16 h-16", color = "#FB651E" }: SVGProps) => (
  <svg className={className} viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Grid of company cards */}
    <g>
      {/* Row 1 */}
      <rect x="15" y="15" width="25" height="25" fill={color} opacity="0.2" rx="4"/>
      <rect x="15" y="15" width="25" height="25" stroke={color} strokeWidth="1.5" rx="4"/>

      <rect x="47.5" y="15" width="25" height="25" fill={color} opacity="0.3" rx="4"/>
      <rect x="47.5" y="15" width="25" height="25" stroke={color} strokeWidth="1.5" rx="4"/>

      <rect x="80" y="15" width="25" height="25" fill={color} opacity="0.2" rx="4"/>
      <rect x="80" y="15" width="25" height="25" stroke={color} strokeWidth="1.5" rx="4"/>
    </g>

    <g>
      {/* Row 2 */}
      <rect x="15" y="47.5" width="25" height="25" fill={color} opacity="0.3" rx="4"/>
      <rect x="15" y="47.5" width="25" height="25" stroke={color} strokeWidth="1.5" rx="4"/>

      <rect x="47.5" y="47.5" width="25" height="25" fill={color} opacity="0.2" rx="4"/>
      <rect x="47.5" y="47.5" width="25" height="25" stroke={color} strokeWidth="1.5" rx="4"/>

      <rect x="80" y="47.5" width="25" height="25" fill={color} opacity="0.4" rx="4"/>
      <rect x="80" y="47.5" width="25" height="25" stroke={color} strokeWidth="1.5" rx="4"/>
    </g>

    <g>
      {/* Row 3 */}
      <rect x="15" y="80" width="25" height="25" fill={color} opacity="0.2" rx="4"/>
      <rect x="15" y="80" width="25" height="25" stroke={color} strokeWidth="1.5" rx="4"/>

      <rect x="47.5" y="80" width="25" height="25" fill={color} opacity="0.2" rx="4"/>
      <rect x="47.5" y="80" width="25" height="25" stroke={color} strokeWidth="1.5" rx="4"/>

      <rect x="80" y="80" width="25" height="25" fill={color} opacity="0.3" rx="4"/>
      <rect x="80" y="80" width="25" height="25" stroke={color} strokeWidth="1.5" rx="4"/>
    </g>

    {/* YC logo in one card */}
    <g transform="translate(50.5, 50.5)">
      <rect width="16" height="16" fill={color} rx="2"/>
      <path fill="#FFFFFF" transform="scale(0.0125)" d="M903.151794,314.269287 C893.320129,332.959991 883.552734,351.684845 873.644104,370.334656 C849.441650,415.888000 825.170959,461.405090 800.932861,506.939514 C767.947021,568.907776 734.964966,630.878052 701.983765,692.848755 C696.208130,703.700928 690.305786,714.489624 684.771667,725.463867 C683.343628,728.295776 682.402954,731.719177 682.398193,734.872620 C682.272095,819.193787 682.297791,903.515198 682.297791,987.836548 C682.297791,989.997375 682.297791,992.158203 682.297791,994.697876 C654.192932,994.697876 626.319641,994.697876 597.921387,994.697876 C597.921387,992.672668 597.921387,990.723267 597.921387,988.773865 C597.921387,902.452820 597.946533,816.131653 597.821045,729.810791 C597.816406,726.662781 596.932556,723.198364 595.452698,720.416443 C556.466248,647.126831 517.345825,573.908569 478.250824,500.676727 C454.515594,456.216400 430.783142,411.754608 407.052551,367.291840 C398.365112,351.014648 389.684235,334.733917 381.008636,318.450439 C380.239929,317.007629 379.532837,315.531982 378.531769,313.544830 C380.187714,313.354279 381.393097,313.095306 382.598663,313.094421 C413.260986,313.072052 443.923401,313.112396 474.585419,313.017517 C477.432648,313.008728 478.971436,313.815155 480.282410,316.467896 C523.761108,404.446381 567.465027,492.313812 610.791199,580.367126 C621.714111,602.566162 631.470154,625.339294 641.770325,647.845032 C641.957581,648.254089 642.243164,648.618103 642.707825,649.364624 C643.552307,647.834534 644.304993,646.580261 644.955994,645.275330 C699.542419,535.857422 754.135742,426.442963 808.622437,316.975433 C810.117737,313.971313 811.754456,312.982147 815.054810,312.998718 C844.048645,313.144196 873.043396,313.098969 902.520813,313.445587 C903.053101,313.943726 903.102417,314.106506 903.151794,314.269287 z"/>
    </g>
  </svg>
);

// Paul Graham Essays Icon - custom book/wisdom icon
export const PGEssaysSVG = ({ className = "w-8 h-8", color = "#FB651E" }: SVGProps) => (
  <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Book */}
    <rect x="25" y="20" width="50" height="65" fill={color} opacity="0.1" rx="3"/>
    <rect x="25" y="20" width="50" height="65" stroke={color} strokeWidth="2" rx="3"/>

    {/* Book spine */}
    <line x1="35" y1="20" x2="35" y2="85" stroke={color} strokeWidth="1.5" opacity="0.4"/>

    {/* Pages */}
    <line x="42" y1="30" x2="68" y2="30" stroke={color} strokeWidth="1.5" opacity="0.6"/>
    <line x1="42" y1="40" x2="68" y2="40" stroke={color} strokeWidth="1.5" opacity="0.6"/>
    <line x1="42" y1="50" x2="68" y2="50" stroke={color} strokeWidth="1.5" opacity="0.6"/>
    <line x1="42" y1="60" x2="60" y2="60" stroke={color} strokeWidth="1.5" opacity="0.6"/>

    {/* YC logo on book cover */}
    <g transform="translate(46, 68)">
      <rect width="12" height="12" fill={color} rx="1.5"/>
      <path fill="#FFFFFF" transform="scale(0.0094)" d="M903.151794,314.269287 C893.320129,332.959991 883.552734,351.684845 873.644104,370.334656 C849.441650,415.888000 825.170959,461.405090 800.932861,506.939514 C767.947021,568.907776 734.964966,630.878052 701.983765,692.848755 C696.208130,703.700928 690.305786,714.489624 684.771667,725.463867 C683.343628,728.295776 682.402954,731.719177 682.398193,734.872620 C682.272095,819.193787 682.297791,903.515198 682.297791,987.836548 C682.297791,989.997375 682.297791,992.158203 682.297791,994.697876 C654.192932,994.697876 626.319641,994.697876 597.921387,994.697876 C597.921387,992.672668 597.921387,990.723267 597.921387,988.773865 C597.921387,902.452820 597.946533,816.131653 597.821045,729.810791 C597.816406,726.662781 596.932556,723.198364 595.452698,720.416443 C556.466248,647.126831 517.345825,573.908569 478.250824,500.676727 C454.515594,456.216400 430.783142,411.754608 407.052551,367.291840 C398.365112,351.014648 389.684235,334.733917 381.008636,318.450439 C380.239929,317.007629 379.532837,315.531982 378.531769,313.544830 C380.187714,313.354279 381.393097,313.095306 382.598663,313.094421 C413.260986,313.072052 443.923401,313.112396 474.585419,313.017517 C477.432648,313.008728 478.971436,313.815155 480.282410,316.467896 C523.761108,404.446381 567.465027,492.313812 610.791199,580.367126 C621.714111,602.566162 631.470154,625.339294 641.770325,647.845032 C641.957581,648.254089 642.243164,648.618103 642.707825,649.364624 C643.552307,647.834534 644.304993,646.580261 644.955994,645.275330 C699.542419,535.857422 754.135742,426.442963 808.622437,316.975433 C810.117737,313.971313 811.754456,312.982147 815.054810,312.998718 C844.048645,313.144196 873.043396,313.098969 902.520813,313.445587 C903.053101,313.943726 903.102417,314.106506 903.151794,314.269287 z"/>
    </g>

    {/* Lightbulb/wisdom indicator */}
    <circle cx="70" cy="28" r="8" fill="#FFC107" opacity="0.8"/>
    <path d="M 68 22 L 70 20 L 72 22" stroke="#FFC107" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="62" y1="28" x2="60" y2="28" stroke="#FFC107" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="78" y1="28" x2="80" y2="28" stroke="#FFC107" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);
