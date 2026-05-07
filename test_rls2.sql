BEGIN;
-- Drop superuser privileges for this transaction
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub": "b7347da7-b95b-44b3-8039-19e53f0b701c", "role": "authenticated"}';

SELECT (SELECT count(*) FROM hotels) as total_hotels,
       (SELECT count(*) FROM user_hotels) as total_user_hotels;
ROLLBACK;
