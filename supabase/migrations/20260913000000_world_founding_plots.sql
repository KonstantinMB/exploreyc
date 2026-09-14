-- ExploreYC World: founding plots — the launch-window promotion.
--
-- The first FREE_PLOT_LIMIT (backend/world_constants.py) companies get a plot
-- without paying, so a launch-day globe carries real startups instead of
-- nothing. Additive and idempotent; mirrored inline in backend/database.py for
-- local SQLite.
--
-- WHAT THE SCHEMA GUARANTEES, so the product cannot drift off it:
--
--   * `founding` marks a comped listing. It is surfaced as a "Founding plot"
--     chip everywhere the plot is identified — a free plot must never be
--     mistakable for a purchase.
--   * A founding plot is written with total_cents = 0 (the DB method hardcodes
--     the zero; no caller supplies it). It therefore cannot appear as money on
--     the 'richest' or 'rising' boards, and cannot displace a paying plot on
--     either. It does count on 'planted', which ranks by count and age.
--   * uq_world_plots_founding_user is the one-free-plot-per-account rule, held
--     by the database rather than by a check in application code.
--   * The global cap is enforced by the conditional INSERT in
--     claim_world_founding_plot, serialized on pg_advisory_xact_lock — see
--     FOUNDING_CLAIM_LOCK_KEY.

ALTER TABLE world_plots
    ADD COLUMN IF NOT EXISTS founding BOOLEAN NOT NULL DEFAULT FALSE;

-- One founding plot per account. Partial, so paying customers are unaffected
-- and a user may still hold any number of paid plots.
CREATE UNIQUE INDEX IF NOT EXISTS uq_world_plots_founding_user
    ON world_plots (user_id) WHERE founding;

-- "How many founding plots exist?" runs on every page load of the stake modal.
CREATE INDEX IF NOT EXISTS idx_world_plots_founding
    ON world_plots (founding) WHERE founding;
