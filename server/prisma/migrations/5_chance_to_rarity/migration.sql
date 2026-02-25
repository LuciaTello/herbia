-- Replace chancePercent (integer 0-100) with rarity (string: 'common' | 'rare' | 'veryRare')

ALTER TABLE suggested_plants ADD COLUMN rarity TEXT NOT NULL DEFAULT 'common';

UPDATE suggested_plants SET rarity = CASE
  WHEN chance_percent >= 50 THEN 'common'
  WHEN chance_percent >= 20 THEN 'rare'
  ELSE 'veryRare'
END;

ALTER TABLE suggested_plants DROP COLUMN chance_percent;
