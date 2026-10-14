-- ============================================================================
-- V7__embodied_carbon_factors.sql — embodied-carbon-for-purchases feature
-- New table `embodied_carbon_factors`: per-category "embodied carbon" (the
-- cradle-to-shelf CO2e baked into manufacturing a product before the user
-- ever buys it), DATA not code, same pattern as `emission_factors` (V1/V3).
--
-- `alternative_category` optionally points at another row in this same table
-- that represents a natural lower-carbon substitute for the category (e.g.
-- 'electronics' -> 'refurbished_electronics'), so the backend can compute a
-- concrete alternative estimate without calling an AI model. Categories with
-- no natural substitute leave this NULL and the service falls back to an
-- AI-generated one-line tip (see the `embodied_carbon_alt_tip` prompt
-- template below).
--
-- Values below are representative/illustrative defaults assembled from
-- commonly-cited life-cycle-assessment ballparks (e.g. average smartphone,
-- average garment, average shoe pair). They are NOT region-certified or
-- audited figures — same spirit/caveat as the V3 emission_factors seed data.
-- Idempotent via ON CONFLICT so it can re-run safely.
-- ============================================================================

CREATE TABLE embodied_carbon_factors (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category              VARCHAR(40) NOT NULL,
    label                 VARCHAR(120) NOT NULL,
    kg_co2e_per_unit      NUMERIC(10,4) NOT NULL,
    unit                  VARCHAR(12) NOT NULL DEFAULT 'item',
    source                VARCHAR(200),
    alternative_category  VARCHAR(40),
    effective_from        DATE NOT NULL DEFAULT CURRENT_DATE,
    effective_to          DATE,
    active                BOOLEAN NOT NULL DEFAULT TRUE,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by            UUID,
    updated_by            UUID
);
CREATE UNIQUE INDEX ux_embodied_carbon_factor_key ON embodied_carbon_factors (category, effective_from);
CREATE TRIGGER trg_embodied_carbon_factors_updated BEFORE UPDATE ON embodied_carbon_factors FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---- primary categories + their lower-carbon alternative counterparts ----
INSERT INTO embodied_carbon_factors (category, label, kg_co2e_per_unit, unit, source, alternative_category)
VALUES
  ('electronics','Electronics (generic device)',85.0000,'item','Representative default — illustrative LCA ballpark, not region/certified','refurbished_electronics'),
  ('refurbished_electronics','Refurbished electronics',15.0000,'item','Representative default — illustrative LCA ballpark, not region/certified',NULL),
  ('clothing','Clothing item (new)',22.0000,'item','Representative default — illustrative LCA ballpark, not region/certified','secondhand_clothing'),
  ('secondhand_clothing','Secondhand clothing item',3.0000,'item','Representative default — illustrative LCA ballpark, not region/certified',NULL),
  ('packaged_food','Packaged food item',1.5000,'item','Representative default — illustrative LCA ballpark, not region/certified','bulk_unpackaged_food'),
  ('bulk_unpackaged_food','Bulk / unpackaged food item',0.5000,'item','Representative default — illustrative LCA ballpark, not region/certified',NULL),
  ('furniture','Furniture piece (new)',90.0000,'item','Representative default — illustrative LCA ballpark, not region/certified','secondhand_furniture'),
  ('secondhand_furniture','Secondhand furniture piece',10.0000,'item','Representative default — illustrative LCA ballpark, not region/certified',NULL),
  ('appliances','Major appliance (new)',150.0000,'item','Representative default — illustrative LCA ballpark, not region/certified','refurbished_appliances'),
  ('refurbished_appliances','Refurbished appliance',30.0000,'item','Representative default — illustrative LCA ballpark, not region/certified',NULL),
  ('footwear','Footwear (new pair)',14.0000,'item','Representative default — illustrative LCA ballpark, not region/certified','secondhand_footwear'),
  ('secondhand_footwear','Secondhand footwear pair',2.0000,'item','Representative default — illustrative LCA ballpark, not region/certified',NULL),
  ('toys','Toy (new)',5.0000,'item','Representative default — illustrative LCA ballpark, not region/certified','secondhand_toys'),
  ('secondhand_toys','Secondhand toy',1.0000,'item','Representative default — illustrative LCA ballpark, not region/certified',NULL),
  ('books','Book (new, printed)',2.5000,'item','Representative default — illustrative LCA ballpark, not region/certified','secondhand_books'),
  ('secondhand_books','Secondhand book',0.3000,'item','Representative default — illustrative LCA ballpark, not region/certified',NULL)
ON CONFLICT (category, effective_from) DO NOTHING;

-- ---- prompt template for the AI-generated alternative-suggestion fallback ----
-- Used only when a category has no `alternative_category` mapped above.
INSERT INTO prompt_templates (template_key, version, body, variables, description)
VALUES
  ('embodied_carbon_alt_tip',1,
   'A user is about to buy a product in the "{{category}}" category{{product_hint}}. In one encouraging sentence (max 30 words), suggest a concrete lower-carbon alternative or habit for this category. No numbers you are not sure of. Plain text, no markdown.',
   '{"category":"string","product_hint":"string"}'::jsonb,
   'One-line lower-carbon alternative tip for embodied-carbon purchase categories without a mapped substitute')
ON CONFLICT (template_key, version) DO NOTHING;
