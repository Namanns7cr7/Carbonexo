-- ============================================================================
-- seed.sql — DEV / DEMO data only. Do NOT run in production.
-- Reference/config data ships via migration V3__reference_data.sql.
-- This file adds a demo user whose numbers match the design mock
-- (today 6.8 kg CO2 · ↓ vs yesterday · 5-day streak · welcome credits).
--
-- Demo login:  email = yash@ecotrack.dev   password = password
-- Password hash below is the canonical bcrypt for "password" (Spring docs).
-- Replace before any non-local use.
-- Idempotent: clears the demo user's rows first, then re-inserts.
-- ============================================================================

DO $$
DECLARE
    demo_user UUID := '00000000-0000-0000-0000-000000000001';
BEGIN
    -- clean prior demo rows (FKs cascade from users)
    DELETE FROM users WHERE id = demo_user;

    INSERT INTO users (id, email, password_hash, display_name, role, status, email_verified)
    VALUES (demo_user, 'yash@ecotrack.dev',
            '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
            'Yash', 'USER', 'ACTIVE', true);

    INSERT INTO user_profiles (user_id, name, travel_mode, daily_distance_km, diet,
                               electricity_usage, shopping_habit, weekly_goal_pct, region, onboarded)
    VALUES (demo_user, 'Yash', 'Car', 18, 'Mixed', 'Medium', 'Sometimes', 15, 'GLOBAL', true);

    -- today: travel 3.1 / food 1.9 / electricity 1.8 = 6.8 kg
    INSERT INTO activity_logs (user_id, category, factor_key, label, emoji, quantity, unit, co2_kg, note, activity_date, source) VALUES
      (demo_user,'travel','car_ride','Car commute','🚗',13,'km',2.400,'13 km',CURRENT_DATE,'manual'),
      (demo_user,'travel','metro_train','Metro ride','🚇',17,'km',0.700,'17 km',CURRENT_DATE,'manual'),
      (demo_user,'food','chicken_meal','Chicken lunch','🍗',1,'item',1.200,'1 meal',CURRENT_DATE,'manual'),
      (demo_user,'food','veg_meal','Veg dinner','🥗',1,'item',0.700,'1 meal',CURRENT_DATE,'manual'),
      (demo_user,'electricity','home_electricity','Home electricity','⚡',4,'kWh',1.800,'4 kWh',CURRENT_DATE,'manual');

    -- prior 4 consecutive days -> 5-day streak; daily totals 7.7 / 9.1 / 7.2 / 8.4
    INSERT INTO activity_logs (user_id, category, factor_key, label, emoji, co2_kg, note, activity_date, source) VALUES
      (demo_user,'travel','car_ride','Car commute','🚗',3.542,'commute',CURRENT_DATE-1,'manual'),
      (demo_user,'food','chicken_meal','Mixed meals','🍽️',2.156,'meals',CURRENT_DATE-1,'manual'),
      (demo_user,'electricity','home_electricity','Home electricity','⚡',2.002,'kWh',CURRENT_DATE-1,'manual'),
      (demo_user,'travel','car_ride','Car commute','🚗',4.186,'commute',CURRENT_DATE-2,'manual'),
      (demo_user,'food','chicken_meal','Mixed meals','🍽️',2.548,'meals',CURRENT_DATE-2,'manual'),
      (demo_user,'electricity','home_electricity','Home electricity','⚡',2.366,'kWh',CURRENT_DATE-2,'manual'),
      (demo_user,'travel','car_ride','Car commute','🚗',3.312,'commute',CURRENT_DATE-3,'manual'),
      (demo_user,'food','chicken_meal','Mixed meals','🍽️',2.016,'meals',CURRENT_DATE-3,'manual'),
      (demo_user,'electricity','home_electricity','Home electricity','⚡',1.872,'kWh',CURRENT_DATE-3,'manual'),
      (demo_user,'travel','car_ride','Car commute','🚗',3.864,'commute',CURRENT_DATE-4,'manual'),
      (demo_user,'food','chicken_meal','Mixed meals','🍽️',2.352,'meals',CURRENT_DATE-4,'manual'),
      (demo_user,'electricity','home_electricity','Home electricity','⚡',2.184,'kWh',CURRENT_DATE-4,'manual');

    -- a plan with one action completed
    INSERT INTO user_plans (user_id, action_template_id, done, done_at)
    SELECT demo_user, id, true, now() FROM action_templates WHERE action_key = 'metro-commute';
    INSERT INTO user_plans (user_id, action_template_id, done)
    SELECT demo_user, id, false FROM action_templates WHERE action_key = 'meatless';

    -- welcome credits on the ledger
    INSERT INTO credit_ledger (user_id, delta, balance_after, reason, rule_key, ref_type)
    VALUES (demo_user, 100, 100, 'Welcome bonus', 'signup_bonus', 'signup');
END $$;
