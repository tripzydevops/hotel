WITH setup AS (
  SELECT set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', '{"sub": "b7347da7-b95b-44b3-8039-19e53f0b701c", "role": "authenticated"}', true)
),
pgrst_source AS (
    SELECT * FROM user_hotels WHERE user_id = 'b7347da7-b95b-44b3-8039-19e53f0b701c'
)
SELECT pgrst_source.hotel_id, (SELECT count(*) FROM hotels WHERE hotels.id = pgrst_source.hotel_id) as hotel_count
FROM setup, pgrst_source;
