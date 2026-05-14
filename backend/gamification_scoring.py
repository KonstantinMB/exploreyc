"""
Gamification scoring module for startup success prediction.
Calculates idea quality, team profile, and market potential scores.
"""

from typing import Optional, List, Dict, Tuple
import math
from datetime import datetime
from collections import Counter


class GamificationScorer:
    """Scores startup ideas on multiple dimensions with gamification."""

    # Tier thresholds
    TIER_THRESHOLDS = {
        "bronze": 0,
        "silver": 26,
        "gold": 51,
        "platinum": 76
    }

    # Market indicators mapping to points
    MARKET_INDICATOR_SCORES = {
        "green": 40,      # Hot market
        "yellow": 25,     # Emerging market
        "crowded": 10     # Saturated market
    }

    # Industry scoring bonuses
    INDUSTRY_BONUSES = {
        "ai": 15,
        "ml": 15,
        "machine_learning": 15,
        "deep_learning": 15,
        "llm": 15,
        "blockchain": 12,
        "crypto": 12,
        "web3": 12,
        "saas": 10,
        "marketplace": 12,
        "platform": 12,
        "biotech": 10,
        "healthcare": 8,
        "fintech": 10,
    }

    # Achievement definitions
    ACHIEVEMENTS = {
        "idea_master": {
            "name": "Idea Master",
            "description": "Match similarity > 0.85 with a unicorn",
            "icon": "🎯",
            "requirement": "match_unicorn_85"
        },
        "market_genius": {
            "name": "Market Genius",
            "description": "Green market indicator with high growth",
            "icon": "📈",
            "requirement": "market_genius"
        },
        "team_synergy": {
            "name": "Team Synergy Pro",
            "description": "Strong founder composition detected",
            "icon": "👥",
            "requirement": "team_score_75"
        },
        "crowded_pioneer": {
            "name": "Crowded Pioneer",
            "description": "High score in crowded market (beating the odds)",
            "icon": "🏆",
            "requirement": "crowded_high_score"
        },
        "underdog_disruptor": {
            "name": "Underdog Disruptor",
            "description": "Low-familiarity market with strong metrics",
            "icon": "🚀",
            "requirement": "underdog_strong_score"
        },
        "ai_revolution": {
            "name": "AI Revolution Pioneer",
            "description": "Building in the hottest category",
            "icon": "⚡",
            "requirement": "ai_category"
        },
        "first_mover": {
            "name": "First Mover Advantage",
            "description": "Pre-existing market players not yet dominant",
            "icon": "⏱️",
            "requirement": "first_mover"
        },
        "bootstrap_ready": {
            "name": "Bootstrap Ready",
            "description": "Low funding needed based on business model",
            "icon": "💰",
            "requirement": "bootstrap_model"
        },
        "venture_scale": {
            "name": "Venture Scale",
            "description": "High growth potential detected",
            "icon": "🌍",
            "requirement": "venture_potential"
        },
        "repeat_founder": {
            "name": "Serial Entrepreneur",
            "description": "Previous startup experience detected",
            "icon": "🔄",
            "requirement": "repeat_founder"
        }
    }

    # Challenges
    CHALLENGES = {
        "unicorn_hunt": {
            "name": "Unicorn Hunt",
            "description": "Match with a $1B+ valuation company",
            "icon": "🦄",
            "reward_xp": 50
        },
        "stage_climb": {
            "name": "Stage Climb",
            "description": "Score higher than Series A+ companies",
            "icon": "📊",
            "reward_xp": 30
        },
        "category_dominator": {
            "name": "Category Dominator",
            "description": "Beat the average score in your industry",
            "icon": "👑",
            "reward_xp": 25
        },
        "market_leader": {
            "name": "Market Leader",
            "description": "Match with top 10% most successful companies",
            "icon": "⭐",
            "reward_xp": 40
        }
    }

    def __init__(self):
        self.idea_stopwords = {
            'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
            'of', 'with', 'by', 'from', 'is', 'was', 'are', 'be', 'been', 'being',
            'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should',
            'could', 'can', 'may', 'might', 'must', 'app', 'platform', 'like',
            'that', 'this', 'it', 'its', 'as', 'if', 'so', 'than', 'then'
        }

    def calculate_idea_quality_score(
        self,
        idea_description: str,
        market_indicator: str,
        similarity_score: float,
        matched_companies_count: int
    ) -> int:
        """
        Calculate idea quality score (0-100).

        Components:
        - Embedding similarity to successful YC companies: 0-40 pts
        - Market indicator quality: 0-40 pts
        - Idea novelty/uniqueness: 0-20 pts
        """
        score = 0

        # 1. Similarity component (0-40)
        similarity_points = min(40, int(similarity_score * 40))
        score += similarity_points

        # 2. Market indicator component (0-40)
        market_points = self.MARKET_INDICATOR_SCORES.get(market_indicator.lower(), 20)
        score += market_points

        # 3. Idea novelty component (0-20)
        novelty_points = self._calculate_novelty_score(idea_description)
        score += novelty_points

        return min(100, score)

    def calculate_team_profile_score(
        self,
        founder_count: Optional[int] = None,
        founder_expertise: Optional[List[str]] = None,
        has_repeat_founder: bool = False,
        has_complementary_skills: bool = False
    ) -> Optional[int]:
        """
        Calculate team profile score (0-100) if team info provided.

        Components:
        - Founder count (ideal: 2-3): 0-30 pts
        - Founder expertise in domain: 0-40 pts
        - Co-founder synergy/complementary skills: 0-30 pts
        """
        if founder_count is None:
            return None

        score = 0

        # 1. Founder count component (0-30)
        # Ideal: 2-3 founders. Penalty for 1, 4+, reward for 2-3
        if founder_count == 1:
            founder_points = 15
        elif 2 <= founder_count <= 3:
            founder_points = 30
        elif founder_count == 4:
            founder_points = 25
        else:  # 5+
            founder_points = 20

        score += founder_points

        # 2. Founder expertise (0-40)
        expertise_points = 0
        if founder_expertise:
            relevant_keywords = [e.lower() for e in founder_expertise]
            expertise_points = min(40, len(relevant_keywords) * 13)

        score += expertise_points

        # 3. Complementary skills & synergy (0-30)
        synergy_points = 0
        if has_repeat_founder:
            synergy_points += 15
        if has_complementary_skills:
            synergy_points += 15

        score += synergy_points

        return min(100, score)

    def calculate_market_potential_score(
        self,
        market_type: str,
        industry_growth_tier: str,
        industry_name: str,
        competition_level: str
    ) -> int:
        """
        Calculate market potential score (0-100).

        Components:
        - Market size tier: 0-15 pts
        - Industry growth rate: 0-40 pts
        - Competitiveness vs opportunity: 0-45 pts
        """
        score = 0

        # 1. Market type component (0-15)
        market_type_lower = market_type.lower()
        if market_type_lower == "b2b" or "enterprise" in market_type_lower:
            market_points = 10
        elif market_type_lower == "platform" or "marketplace" in market_type_lower:
            market_points = 15
        elif market_type_lower == "b2c" or "consumer" in market_type_lower:
            market_points = 5
        else:
            market_points = 8
        score += market_points

        # 2. Industry growth component (0-40)
        growth_tier_lower = industry_growth_tier.lower()
        if "high" in growth_tier_lower:
            growth_points = 40
        elif "medium" in growth_tier_lower:
            growth_points = 25
        else:
            growth_points = 10
        score += growth_points

        # 3. Industry bonus (additional points for hot categories)
        industry_bonus = self._get_industry_bonus(industry_name)
        score += industry_bonus

        # 4. Competitiveness component (0-25)
        competition_lower = competition_level.lower()
        if "low" in competition_lower or "blue ocean" in competition_lower:
            competition_points = 25
        elif "medium" in competition_lower:
            competition_points = 15
        else:  # high/crowded
            competition_points = 5
        score += competition_points

        return min(100, score)

    def calculate_combined_success_score(
        self,
        idea_score: int,
        team_score: Optional[int],
        market_score: int
    ) -> int:
        """
        Calculate overall combined success score (0-100).

        Formula:
        - Idea quality: 40%
        - Team profile: 35% (or 0% if not provided)
        - Market potential: 25%
        """
        if team_score is not None:
            combined = (idea_score * 0.40) + (team_score * 0.35) + (market_score * 0.25)
        else:
            # If no team info, reweight
            combined = (idea_score * 0.50) + (market_score * 0.50)

        return min(100, int(combined))

    def get_tier(self, score: int) -> str:
        """Determine tier based on combined score."""
        if score >= self.TIER_THRESHOLDS["platinum"]:
            return "platinum"
        elif score >= self.TIER_THRESHOLDS["gold"]:
            return "gold"
        elif score >= self.TIER_THRESHOLDS["silver"]:
            return "silver"
        else:
            return "bronze"

    def get_tier_emoji(self, tier: str) -> str:
        """Get emoji for tier."""
        emojis = {
            "bronze": "🥉",
            "silver": "🥈",
            "gold": "🥇",
            "platinum": "🦄"
        }
        return emojis.get(tier, "")

    def calculate_percentile(
        self,
        user_score: int,
        all_yc_scores: List[int]
    ) -> int:
        """
        Calculate percentile rank (0-100) against all YC company success scores.
        Returns the percentage of companies with LOWER scores than user.
        Capped at 99 to avoid showing 100%.
        """
        if not all_yc_scores or len(all_yc_scores) == 0:
            return 50

        # Count how many scores are strictly less than user score
        scores_below = sum(1 for s in all_yc_scores if s < user_score)

        # Calculate percentile: (number below / total) * 100
        # Cap at 99 to avoid showing 100%
        percentile = int((scores_below / len(all_yc_scores)) * 100)
        return min(percentile, 99)

    def determine_achievements(
        self,
        idea_score: int,
        team_score: Optional[int],
        market_score: int,
        combined_score: int,
        market_indicator: str,
        industry_name: str,
        idea_description: str,
        matched_companies: List[Dict],
        has_repeat_founder: bool = False
    ) -> List[Dict]:
        """
        Determine which achievements are unlocked.
        """
        achievements = []

        # 1. Market Genius - Green market + high score
        if market_indicator.lower() == "green" and market_score >= 75:
            achievements.append({
                "id": "market_genius",
                "name": self.ACHIEVEMENTS["market_genius"]["name"],
                "description": self.ACHIEVEMENTS["market_genius"]["description"],
                "icon": self.ACHIEVEMENTS["market_genius"]["icon"],
                "xp_reward": 30
            })

        # 2. Team Synergy - Strong team score
        if team_score and team_score >= 75:
            achievements.append({
                "id": "team_synergy",
                "name": self.ACHIEVEMENTS["team_synergy"]["name"],
                "description": self.ACHIEVEMENTS["team_synergy"]["description"],
                "icon": self.ACHIEVEMENTS["team_synergy"]["icon"],
                "xp_reward": 25
            })

        # 3. Crowded Pioneer - High score in crowded market
        if market_indicator.lower() == "crowded" and combined_score >= 70:
            achievements.append({
                "id": "crowded_pioneer",
                "name": self.ACHIEVEMENTS["crowded_pioneer"]["name"],
                "description": self.ACHIEVEMENTS["crowded_pioneer"]["description"],
                "icon": self.ACHIEVEMENTS["crowded_pioneer"]["icon"],
                "xp_reward": 40
            })

        # 4. Underdog Disruptor - Low-familiarity market with strong metrics
        if idea_score >= 70 and market_indicator.lower() == "yellow":
            achievements.append({
                "id": "underdog_disruptor",
                "name": self.ACHIEVEMENTS["underdog_disruptor"]["name"],
                "description": self.ACHIEVEMENTS["underdog_disruptor"]["description"],
                "icon": self.ACHIEVEMENTS["underdog_disruptor"]["icon"],
                "xp_reward": 35
            })

        # 5. AI Revolution - AI/ML category
        if self._is_ai_category(industry_name, idea_description):
            achievements.append({
                "id": "ai_revolution",
                "name": self.ACHIEVEMENTS["ai_revolution"]["name"],
                "description": self.ACHIEVEMENTS["ai_revolution"]["description"],
                "icon": self.ACHIEVEMENTS["ai_revolution"]["icon"],
                "xp_reward": 20
            })

        # 6. Bootstrap Ready - Low funding business model
        if self._is_bootstrap_model(idea_description):
            achievements.append({
                "id": "bootstrap_ready",
                "name": self.ACHIEVEMENTS["bootstrap_ready"]["name"],
                "description": self.ACHIEVEMENTS["bootstrap_ready"]["description"],
                "icon": self.ACHIEVEMENTS["bootstrap_ready"]["icon"],
                "xp_reward": 15
            })

        # 7. Venture Scale - High growth potential
        if combined_score >= 75 and market_score >= 70:
            achievements.append({
                "id": "venture_scale",
                "name": self.ACHIEVEMENTS["venture_scale"]["name"],
                "description": self.ACHIEVEMENTS["venture_scale"]["description"],
                "icon": self.ACHIEVEMENTS["venture_scale"]["icon"],
                "xp_reward": 25
            })

        # 8. Repeat Founder
        if has_repeat_founder:
            achievements.append({
                "id": "repeat_founder",
                "name": self.ACHIEVEMENTS["repeat_founder"]["name"],
                "description": self.ACHIEVEMENTS["repeat_founder"]["description"],
                "icon": self.ACHIEVEMENTS["repeat_founder"]["icon"],
                "xp_reward": 30
            })

        # 9. Idea Master - Match unicorn with high similarity
        for company in matched_companies:
            if company.get("valuation_usd", 0) >= 1_000_000_000:
                if company.get("similarity", 0) >= 0.85:
                    achievements.append({
                        "id": "idea_master",
                        "name": self.ACHIEVEMENTS["idea_master"]["name"],
                        "description": self.ACHIEVEMENTS["idea_master"]["description"],
                        "icon": self.ACHIEVEMENTS["idea_master"]["icon"],
                        "xp_reward": 50
                    })
                    break

        return achievements

    def determine_challenges(
        self,
        combined_score: int,
        matched_companies: List[Dict],
        industry_name: str,
        all_yc_scores: List[int]
    ) -> List[Dict]:
        """
        Determine active challenges for the user.
        """
        challenges = []

        # Calculate industry average
        industry_avg = sum(all_yc_scores) / len(all_yc_scores) if all_yc_scores else 50

        # 1. Unicorn Hunt
        unicorn_similarity = max([
            c.get("similarity", 0)
            for c in matched_companies
            if c.get("valuation_usd", 0) >= 1_000_000_000
        ], default=0)

        challenges.append({
            "id": "unicorn_hunt",
            "name": self.CHALLENGES["unicorn_hunt"]["name"],
            "description": self.CHALLENGES["unicorn_hunt"]["description"],
            "icon": self.CHALLENGES["unicorn_hunt"]["icon"],
            "progress": min(1.0, unicorn_similarity / 0.85),
            "progress_percent": int(min(100, (unicorn_similarity / 0.85) * 100)),
            "reward_xp": self.CHALLENGES["unicorn_hunt"]["reward_xp"],
            "status": "completed" if unicorn_similarity >= 0.85 else "in_progress"
        })

        # 2. Stage Climb - Beat Series A average
        series_a_avg = 65  # Estimated Series A average
        challenges.append({
            "id": "stage_climb",
            "name": self.CHALLENGES["stage_climb"]["name"],
            "description": self.CHALLENGES["stage_climb"]["description"],
            "icon": self.CHALLENGES["stage_climb"]["icon"],
            "progress": min(1.0, combined_score / series_a_avg),
            "progress_percent": int(min(100, (combined_score / series_a_avg) * 100)),
            "reward_xp": self.CHALLENGES["stage_climb"]["reward_xp"],
            "status": "completed" if combined_score >= series_a_avg else "in_progress"
        })

        # 3. Category Dominator - Beat industry average
        challenges.append({
            "id": "category_dominator",
            "name": self.CHALLENGES["category_dominator"]["name"],
            "description": self.CHALLENGES["category_dominator"]["description"],
            "icon": self.CHALLENGES["category_dominator"]["icon"],
            "progress": min(1.0, combined_score / industry_avg),
            "progress_percent": int(min(100, (combined_score / industry_avg) * 100)),
            "reward_xp": self.CHALLENGES["category_dominator"]["reward_xp"],
            "status": "completed" if combined_score >= industry_avg else "in_progress"
        })

        # 4. Market Leader - Match top 10% companies
        top_10_percent_threshold = sorted(all_yc_scores, reverse=True)[
            max(0, len(all_yc_scores) // 10)
        ] if all_yc_scores else 80

        top_company_similarity = max([
            c.get("similarity", 0)
            for c in matched_companies
        ], default=0)

        challenges.append({
            "id": "market_leader",
            "name": self.CHALLENGES["market_leader"]["name"],
            "description": self.CHALLENGES["market_leader"]["description"],
            "icon": self.CHALLENGES["market_leader"]["icon"],
            "progress": min(1.0, top_company_similarity / 1.0),
            "progress_percent": int(min(100, top_company_similarity * 100)),
            "reward_xp": self.CHALLENGES["market_leader"]["reward_xp"],
            "status": "completed" if top_company_similarity >= 0.80 else "in_progress"
        })

        return challenges

    # Helper methods

    def _calculate_novelty_score(self, idea_description: str) -> int:
        """Calculate novelty based on unique terms vs stopwords."""
        words = idea_description.lower().split()
        unique_words = set(w for w in words if w not in self.idea_stopwords)

        # Penalize short ideas, reward longer with more unique terms
        if len(words) < 10:
            return 5
        elif len(words) < 30:
            return 10
        else:
            # More unique words = higher novelty
            novelty_ratio = len(unique_words) / len(words)
            return int(min(20, novelty_ratio * 20))

    def _get_industry_bonus(self, industry_name: str) -> int:
        """Get bonus points for hot industries."""
        industry_lower = industry_name.lower()

        for keyword, bonus in self.INDUSTRY_BONUSES.items():
            if keyword in industry_lower:
                return bonus

        return 0

    def _is_ai_category(self, industry_name: str, idea_description: str) -> bool:
        """Check if idea is in AI/ML category."""
        text = f"{industry_name} {idea_description}".lower()
        ai_keywords = ['ai', 'ml', 'machine learning', 'deep learning', 'llm', 'neural', 'gpt']
        return any(keyword in text for keyword in ai_keywords)

    def _is_bootstrap_model(self, idea_description: str) -> bool:
        """Check if business model suggests bootstrap-friendly."""
        text = idea_description.lower()
        bootstrap_keywords = ['saas', 'marketplace', 'tools', 'software', 'api', 'plugin']
        return any(keyword in text for keyword in bootstrap_keywords)
