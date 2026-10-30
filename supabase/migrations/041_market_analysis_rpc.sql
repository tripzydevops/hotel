-- Migration: 041_market_analysis_rpc.sql
-- Description: Implement database-level pricing extraction, currency conversion, room matching, and market analysis aggregations to optimize page load speeds.

-- BEGIN;

-- Drop old function to avoid conflicts with signature changes
DROP FUNCTION IF EXISTS public.get_market_analysis_aggregates(uuid, text, text, date, date, jsonb);
DROP FUNCTION IF EXISTS public.get_market_analysis_aggregates(uuid, text, text, date, date, jsonb, text, text);


-- 1. Price extraction from text format and conversion


CREATE OR REPLACE FUNCTION public.extract_price_sql(p_val text, p_currency text)
RETURNS numeric
LANGUAGE plpgsql
AS $$
DECLARE
    s_clean text;
    dots int;
    commas int;
    last_dot int;
    last_comma int;
    trailing_len int;
BEGIN
    IF p_val IS NULL THEN
        RETURN NULL;
    END IF;

    -- Trim and clean: keep only digits, dots, commas
    s_clean := regexp_replace(p_val, '[^\d.,]', '', 'g');
    s_clean := trim(both '.,' from s_clean);
    IF s_clean = '' THEN
        RETURN NULL;
    END IF;

    dots := length(s_clean) - length(replace(s_clean, '.', ''));
    commas := length(s_clean) - length(replace(s_clean, ',', ''));

    -- Case 1: Both exist (e.g. 3.825,00 or 3,825.00)
    IF dots > 0 AND commas > 0 THEN
        last_dot := position('.' in reverse(s_clean));
        last_comma := position(',' in reverse(s_clean));
        IF last_comma < last_dot THEN
            -- Comma is decimal separator. Remove dots, replace comma with dot.
            s_clean := replace(replace(s_clean, '.', ''), ',', '.');
        ELSE
            -- Dot is decimal separator. Remove commas.
            s_clean := replace(s_clean, ',', '');
        END IF;
    -- Case 2: Only dots exist
    ELSIF dots > 0 THEN
        IF dots > 1 THEN
            s_clean := replace(s_clean, '.', '');
        ELSE
            -- Exactly one dot. Check trailing digits.
            trailing_len := length(split_part(s_clean, '.', 2));
            IF trailing_len = 3 THEN
                -- Treat as thousands separator
                s_clean := replace(s_clean, '.', '');
            END IF;
        END IF;
    -- Case 3: Only commas exist
    ELSIF commas > 0 THEN
        IF commas > 1 THEN
            s_clean := replace(s_clean, ',', '');
        ELSE
            -- Exactly one comma. Check trailing digits.
            trailing_len := length(split_part(s_clean, ',', 2));
            IF trailing_len = 3 THEN
                -- Treat as thousands separator
                s_clean := replace(s_clean, ',', '');
            ELSE
                s_clean := replace(s_clean, ',', '.');
            END IF;
        END IF;
    END IF;

    RETURN s_clean::numeric;
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$;


-- 2. Currency conversion
CREATE OR REPLACE FUNCTION public.convert_currency_sql(
    p_amount numeric,
    p_from_currency text,
    p_to_currency text,
    p_exchange_rates jsonb
)
RETURNS numeric
LANGUAGE plpgsql
AS $$
DECLARE
    from_curr text;
    to_curr text;
    usd_rate numeric;
    usd_amount numeric;
    usd_to_target numeric;
BEGIN
    from_curr := upper(coalesce(p_from_currency, 'TRY'));
    to_curr := upper(coalesce(p_to_currency, 'TRY'));

    IF from_curr = to_curr THEN
        RETURN p_amount;
    END IF;

    -- Get rate to convert from_curr to USD (rate * amount = USD)
    usd_rate := (p_exchange_rates->>from_curr)::numeric;
    IF usd_rate IS NULL THEN
        usd_rate := CASE 
            WHEN from_curr = 'USD' THEN 1.0
            WHEN from_curr = 'EUR' THEN 1.08
            WHEN from_curr = 'GBP' THEN 1.26
            WHEN from_curr = 'TRY' OR from_curr = 'TL' THEN 0.029
            ELSE 1.0
        END;
    END IF;

    usd_amount := p_amount * usd_rate;

    -- Get rate to convert USD to to_curr (USD / rate = target amount)
    usd_to_target := (p_exchange_rates->>to_curr)::numeric;
    IF usd_to_target IS NULL THEN
        usd_to_target := CASE 
            WHEN to_curr = 'USD' THEN 1.0
            WHEN to_curr = 'EUR' THEN 1.08
            WHEN to_curr = 'GBP' THEN 1.26
            WHEN to_curr = 'TRY' OR to_curr = 'TL' THEN 0.029
            ELSE 1.0
        END;
    END IF;

    IF usd_to_target = 0 THEN
        RETURN 0.0;
    END IF;

    RETURN round((usd_amount / usd_to_target) * 100.0) / 100.0;
END;
$$;


-- 3. Room type selection and matching
CREATE OR REPLACE FUNCTION public.get_price_for_room_sql(
    p_lead_price numeric,
    p_currency text,
    p_room_types jsonb,
    p_target_room_type text
)
RETURNS TABLE (
    price numeric,
    matched_room_name text,
    match_score numeric
)
LANGUAGE plpgsql
AS $$
DECLARE
    t_lower text;
    r_item jsonb;
    r_name text;
    r_price numeric;
    is_standard boolean;
    is_suite boolean;
    is_deluxe boolean;
    lowest_price numeric;
    lowest_name text;
    has_room_types boolean;
BEGIN
    price := NULL;
    matched_room_name := NULL;
    match_score := 0.0;

    t_lower := lower(trim(coalesce(p_target_room_type, '')));

    -- 1. Exact Match Check
    IF p_room_types IS NOT NULL AND jsonb_typeof(p_room_types) = 'array' AND t_lower <> '' THEN
        FOR r_item IN SELECT * FROM jsonb_array_elements(p_room_types) LOOP
            r_name := lower(trim(coalesce(r_item->>'name', '')));
            IF r_name = t_lower THEN
                r_price := public.extract_price_sql(r_item->>'price', p_currency);
                IF r_price IS NOT NULL AND r_price > 0 THEN
                    price := r_price;
                    matched_room_name := r_item->>'name';
                    match_score := 1.0;
                    RETURN NEXT;
                    RETURN;
                END IF;
            END IF;
        END LOOP;
    END IF;

    -- 2. Category Detection
    is_standard := (
        t_lower LIKE '%standard%' OR t_lower LIKE '%standart%' OR t_lower LIKE '%economy%' OR
        t_lower LIKE '%ekonomik%' OR t_lower LIKE '%promo%' OR t_lower LIKE '%base%' OR
        t_lower LIKE '%classic%' OR t_lower LIKE '%klasik%' OR t_lower LIKE '%double%' OR
        t_lower LIKE '%twin%' OR t_lower LIKE '%single%' OR t_lower LIKE '%tek%' OR
        t_lower LIKE '%çift%' OR t_lower = ''
    );
    is_suite := (t_lower LIKE '%suite%' OR t_lower LIKE '%süit%');
    is_deluxe := (t_lower LIKE '%deluxe%' OR t_lower LIKE '%superior%' OR t_lower LIKE '%premium%' OR t_lower LIKE '%corner%');

    -- 3. Handle Standard Category
    IF is_standard AND NOT is_suite AND NOT is_deluxe THEN
        -- Lead price is the standard
        IF p_lead_price IS NOT NULL AND p_lead_price > 0 THEN
            price := p_lead_price;
            matched_room_name := 'Standard (Main)';
            match_score := 1.0;
            RETURN NEXT;
            RETURN;
        END IF;

        -- Fallback to standard room inside array
        IF p_room_types IS NOT NULL AND jsonb_typeof(p_room_types) = 'array' AND jsonb_array_length(p_room_types) > 0 THEN
            lowest_price := NULL;
            lowest_name := NULL;
            FOR r_item IN SELECT * FROM jsonb_array_elements(p_room_types) LOOP
                r_name := lower(trim(coalesce(r_item->>'name', '')));
                IF (
                    r_name LIKE '%standard%' OR r_name LIKE '%standart%' OR r_name LIKE '%economy%' OR
                    r_name LIKE '%ekonomik%' OR r_name LIKE '%promo%' OR r_name LIKE '%base%' OR
                    r_name LIKE '%classic%' OR r_name LIKE '%klasik%' OR r_name LIKE '%double%' OR
                    r_name LIKE '%twin%' OR r_name LIKE '%single%' OR r_name LIKE '%tek%' OR
                    r_name LIKE '%çift%'
                ) OR NOT (
                    r_name LIKE '%suite%' OR r_name LIKE '%süit%' OR r_name LIKE '%deluxe%' OR
                    r_name LIKE '%superior%' OR r_name LIKE '%premium%'
                ) THEN
                    r_price := public.extract_price_sql(r_item->>'price', p_currency);
                    IF r_price IS NOT NULL AND r_price > 0 THEN
                        IF lowest_price IS NULL OR r_price < lowest_price THEN
                            lowest_price := r_price;
                            lowest_name := r_item->>'name';
                        END IF;
                    END IF;
                END IF;
            END LOOP;

            IF lowest_price IS NOT NULL THEN
                price := lowest_price;
                matched_room_name := COALESCE(lowest_name, 'Standard');
                match_score := 0.8;
                RETURN NEXT;
                RETURN;
            END IF;
        END IF;

        RETURN NEXT;
        RETURN;
    END IF;

    -- 4. Premium Categories (Suite / Deluxe)
    has_room_types := (p_room_types IS NOT NULL AND jsonb_typeof(p_room_types) = 'array' AND jsonb_array_length(p_room_types) > 0);
    IF NOT has_room_types THEN
        -- Legacy fallback to lead price
        IF p_lead_price IS NOT NULL AND p_lead_price > 0 THEN
            price := p_lead_price;
            matched_room_name := 'Legacy Fallback';
            match_score := 0.5;
            RETURN NEXT;
            RETURN;
        END IF;
        RETURN NEXT;
        RETURN;
    END IF;

    lowest_price := NULL;
    lowest_name := NULL;
    FOR r_item IN SELECT * FROM jsonb_array_elements(p_room_types) LOOP
        r_name := lower(trim(coalesce(r_item->>'name', '')));
        r_price := public.extract_price_sql(r_item->>'price', p_currency);
        IF r_price IS NOT NULL AND r_price > 0 THEN
            IF is_suite AND (r_name LIKE '%suite%' OR r_name LIKE '%süit%' OR r_name LIKE '%presidential%' OR r_name LIKE '%kral%') THEN
                IF lowest_price IS NULL OR r_price < lowest_price THEN
                    lowest_price := r_price;
                    lowest_name := r_item->>'name';
                END IF;
            ELSIF is_deluxe AND (r_name LIKE '%deluxe%' OR r_name LIKE '%superior%' OR r_name LIKE '%premium%' OR r_name LIKE '%corner%') THEN
                -- Ensure it's not standard
                IF NOT (r_name LIKE '%standard%' OR r_name LIKE '%standart%') OR r_name LIKE '%deluxe%' THEN
                    IF lowest_price IS NULL OR r_price < lowest_price THEN
                        lowest_price := r_price;
                        lowest_name := r_item->>'name';
                    END IF;
                END IF;
            END IF;
        END IF;
    END LOOP;

    IF lowest_price IS NOT NULL THEN
        price := lowest_price;
        matched_room_name := lowest_name;
        match_score := 0.9;
        RETURN NEXT;
        RETURN;
    END IF;

    RETURN NEXT;
END;
$$;


-- 4. Parse sentiment breakdown safely
CREATE OR REPLACE FUNCTION public.parse_sentiment_breakdown(p_val jsonb)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
BEGIN
    IF p_val IS NULL THEN
        RETURN '[]'::jsonb;
    END IF;
    
    IF jsonb_typeof(p_val) = 'array' THEN
        RETURN p_val;
    ELSIF jsonb_typeof(p_val) = 'string' THEN
        RETURN (p_val->>0)::jsonb;
    ELSE
        RETURN '[]'::jsonb;
    END IF;
EXCEPTION WHEN OTHERS THEN
    RETURN '[]'::jsonb;
END;
$$;


-- 5. Market analysis aggregation RPC
CREATE OR REPLACE FUNCTION public.get_market_analysis_aggregates(
    p_user_id uuid,
    p_room_type text,
    p_display_currency text,
    p_start_date date,
    p_end_date date,
    p_exchange_rates jsonb,
    p_exclude_hotel_ids text DEFAULT NULL,
    p_search_query text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    v_target_hotel_id uuid;
    v_target_hotel_name text;
    v_target_sentiment numeric;
    v_avg_sent_val numeric;
    v_market_average numeric;
    v_market_min numeric;
    v_market_max numeric;
    v_min_hotel jsonb;
    v_max_hotel jsonb;
    v_all_hotels jsonb;
    v_competitors jsonb;
    v_total_hotels int;
    v_total_competitors int;
    v_available_room_types jsonb;
    v_competitive_rank int;
    v_ari_val numeric;
    v_sent_val numeric;
    v_sentiment_breakdown jsonb;
    v_quadrant_label text;
    v_price_rank_list jsonb;
    v_price_history jsonb;
    v_daily_prices jsonb;
    v_advisory_keys jsonb;
    v_target_price numeric;
    v_is_premium boolean;
    v_market_avg_scores jsonb;
    v_pricing_dna text;
BEGIN
    -- Create temporary table for filtered hotels of this user (resolves missing uh.deleted_at issue and applies query/exclude filters)
    CREATE TEMP TABLE temp_filtered_hotels ON COMMIT DROP AS
    SELECT 
        h.id AS hotel_id, 
        h.name, 
        h.location, 
        COALESCE(h.rating, 0.0) AS rating, 
        h.review_count, 
        uh.is_target, 
        h.sentiment_breakdown, 
        uh.pricing_dna
    FROM public.user_hotels uh
    JOIN public.hotels h ON uh.hotel_id = h.id
    WHERE uh.user_id = p_user_id 
      AND uh.deleted_at IS NULL
      AND h.deleted_at IS NULL
      AND (
          p_exclude_hotel_ids IS NULL 
          OR p_exclude_hotel_ids = '' 
          OR NOT (h.id::text = ANY(string_to_array(p_exclude_hotel_ids, ',')))
      )
      AND (
          p_search_query IS NULL 
          OR p_search_query = '' 
          OR (lower(h.name) LIKE '%' || lower(p_search_query) || '%' OR lower(h.location) LIKE '%' || lower(p_search_query) || '%')
      );

    -- Resolve target hotel from filtered list
    SELECT hotel_id, name, rating, pricing_dna
    INTO v_target_hotel_id, v_target_hotel_name, v_target_sentiment, v_pricing_dna
    FROM temp_filtered_hotels
    WHERE is_target = true
    LIMIT 1;

    IF v_target_hotel_id IS NULL THEN
        SELECT hotel_id, name, rating, pricing_dna
        INTO v_target_hotel_id, v_target_hotel_name, v_target_sentiment, v_pricing_dna
        FROM temp_filtered_hotels
        ORDER BY hotel_id ASC
        LIMIT 1;
    END IF;

    -- Return early structure if user has no hotels remaining after filters
    IF v_target_hotel_id IS NULL THEN
        RETURN jsonb_build_object(
            'hotels', '[]'::jsonb,
            'all_hotels', '[]'::jsonb,
            'total_hotels', 0,
            'total_competitors', 0,
            'market_average', 0.0,
            'market_avg', 0.0,
            'market_min', 0.0,
            'market_max', 0.0,
            'target_price', NULL,
            'ari', 100.0,
            'sent_index', 100.0,
            'quadrant_label', 'No Data Found',
            'quadrant_x', 100.0,
            'quadrant_y', 100.0,
            'price_rank_list', '[]'::jsonb,
            'price_history', '[]'::jsonb,
            'daily_prices', '[]'::jsonb,
            'advisory_keys', '[]'::jsonb,
            'sentiment_breakdown', '[]'::jsonb,
            'target_rating', 0.0,
            'market_rating', 0.0,
            'available_room_types', '[]'::jsonb
        );
    END IF;

    v_is_premium := (
        lower(p_room_type) LIKE '%suite%' OR lower(p_room_type) LIKE '%süit%' OR
        lower(p_room_type) LIKE '%deluxe%' OR lower(p_room_type) LIKE '%superior%' OR
        lower(p_room_type) LIKE '%premium%' OR lower(p_room_type) LIKE '%family%' OR
        lower(p_room_type) LIKE '%aile%'
    );

    -- Calculate basic sentiment averages and counts
    SELECT AVG(rating), COUNT(*)
    INTO v_avg_sent_val, v_total_hotels
    FROM temp_filtered_hotels;

    v_total_competitors := GREATEST(0, v_total_hotels - 1);

    SELECT public.parse_sentiment_breakdown(sentiment_breakdown)
    INTO v_sentiment_breakdown
    FROM temp_filtered_hotels
    WHERE hotel_id = v_target_hotel_id;

    -- Sentiment average scores per pillar (Cleanliness, Service, Value, Room, Location)
    WITH sentiment_pillars AS (
        SELECT 
            initcap(item->>'name') AS pillar_name,
            ((item->>'positive')::numeric / (item->>'total')::numeric) * 5.0 AS rating
        FROM temp_filtered_hotels th
        CROSS JOIN LATERAL jsonb_array_elements(public.parse_sentiment_breakdown(th.sentiment_breakdown)) item
        WHERE item->>'total' IS NOT NULL 
          AND (item->>'total')::numeric > 0
    )
    SELECT jsonb_object_agg(pillar_name, avg_rating)
    INTO v_market_avg_scores
    FROM (
        SELECT pillar_name, AVG(rating) AS avg_rating
        FROM sentiment_pillars
        GROUP BY pillar_name
    ) sub;

    -- Create temp table for matched price logs and currency conversions
    CREATE TEMP TABLE temp_matched_logs ON COMMIT DROP AS
    WITH raw_logs AS (
        SELECT 
            pl.hotel_id,
            pl.check_in_date,
            pl.check_out_date,
            pl.price AS lead_price,
            pl.currency,
            pl.room_types,
            pl.recorded_at,
            pl.vendor,
            pl.parity_offers,
            false AS is_historical
        FROM public.price_logs pl
        WHERE pl.hotel_id IN (SELECT hotel_id FROM temp_filtered_hotels)
          AND (p_start_date IS NULL OR pl.check_in_date >= p_start_date)
          AND (p_end_date IS NULL OR pl.check_in_date <= p_end_date)
        ORDER BY pl.recorded_at DESC
        LIMIT 5000
    ),
    historical_logs AS (
        SELECT 
            ph.hotel_id::uuid AS hotel_id,
            ph.date AS check_in_date,
            NULL::date AS check_out_date,
            ph.avg_price::numeric AS lead_price,
            COALESCE(
                (SELECT uh.preferred_currency FROM public.user_hotels uh WHERE uh.hotel_id = ph.hotel_id::uuid AND uh.user_id = p_user_id LIMIT 1),
                'USD'
            ) AS currency,
            CASE 
                WHEN ph.room_type_summary IS NOT NULL AND jsonb_typeof(ph.room_type_summary) = 'object' THEN
                    (
                        SELECT jsonb_agg(jsonb_build_object('name', key, 'price', val->'avg'))
                        FROM jsonb_each(ph.room_type_summary) AS t(key, val)
                    )
                ELSE
                    '[]'::jsonb
            END AS room_types,
            ph.created_at AS recorded_at,
            ph.source AS vendor,
            '[]'::jsonb AS parity_offers,
            true AS is_historical
        FROM public.price_history_daily ph
        WHERE ph.hotel_id::uuid IN (SELECT hotel_id FROM temp_filtered_hotels)
          AND (p_start_date IS NULL OR ph.date >= p_start_date)
          AND (p_end_date IS NULL OR ph.date <= p_end_date)
    ),
    combined AS (
        SELECT * FROM raw_logs
        UNION ALL
        SELECT * FROM historical_logs WHERE p_start_date IS NOT NULL AND p_end_date IS NOT NULL
    ),
    logs_with_room_price AS (
        SELECT 
            c.hotel_id,
            c.check_in_date,
            c.check_out_date,
            c.recorded_at,
            c.vendor,
            c.parity_offers,
            c.is_historical,
            r.price AS raw_price,
            r.matched_room_name,
            r.match_score,
            public.convert_currency_sql(r.price, c.currency, p_display_currency, p_exchange_rates) AS converted_price
        FROM combined c
        CROSS JOIN LATERAL public.get_price_for_room_sql(c.lead_price, c.currency, c.room_types, p_room_type) r
        WHERE r.price IS NOT NULL AND r.price > 0
    ),
    logs_with_lead_prev AS (
        SELECT 
            *,
            LEAD(converted_price) OVER (PARTITION BY hotel_id, check_in_date ORDER BY recorded_at DESC) AS prev_converted_price
        FROM logs_with_room_price
    )
    SELECT 
        hotel_id,
        check_in_date,
        check_out_date,
        recorded_at,
        vendor,
        parity_offers,
        is_historical,
        raw_price,
        matched_room_name,
        match_score,
        converted_price,
        CASE 
            WHEN prev_converted_price IS NOT NULL AND prev_converted_price > 0 THEN
                CASE 
                    WHEN (converted_price - prev_converted_price) / prev_converted_price <= -0.10 THEN 'Flash Sale'
                    WHEN (converted_price - prev_converted_price) / prev_converted_price >= 0.15 THEN 'Rate Spike'
                    ELSE 'Price Scan'
                END
            ELSE 'Price Scan'
        END AS event_label
    FROM logs_with_lead_prev;

    CREATE INDEX idx_temp_matched_logs_hotel_id ON temp_matched_logs(hotel_id);
    CREATE INDEX idx_temp_matched_logs_date ON temp_matched_logs(check_in_date);

    -- Get target price
    SELECT converted_price INTO v_target_price
    FROM temp_matched_logs
    WHERE hotel_id = v_target_hotel_id
    ORDER BY recorded_at DESC
    LIMIT 1;

    -- Build price ranks
    WITH latest_scans AS (
        SELECT DISTINCT ON (hotel_id)
            hotel_id,
            converted_price,
            matched_room_name,
            match_score,
            parity_offers
        FROM temp_matched_logs
        ORDER BY hotel_id, recorded_at DESC
    ),
    ranks AS (
        SELECT 
            ls.hotel_id,
            ls.converted_price,
            ls.matched_room_name,
            ls.match_score,
            ls.parity_offers,
            h.name,
            h.rating,
            h.review_count,
            (h.hotel_id = v_target_hotel_id) AS is_target,
            ROW_NUMBER() OVER (ORDER BY ls.converted_price ASC) AS price_rank
        FROM latest_scans ls
        JOIN temp_filtered_hotels h ON ls.hotel_id = h.hotel_id
    )
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', hotel_id,
            'name', name,
            'price', converted_price,
            'rank', price_rank,
            'is_target', is_target,
            'rating', rating,
            'review_count', review_count,
            'matched_room_name', matched_room_name,
            'match_score', match_score,
            'offers', parity_offers
        )
    )
    INTO v_price_rank_list
    FROM ranks;

    -- Overall market stats
    WITH latest_scans AS (
        SELECT DISTINCT ON (hotel_id) converted_price
        FROM temp_matched_logs
        ORDER BY hotel_id, recorded_at DESC
    )
    SELECT AVG(converted_price), MIN(converted_price), MAX(converted_price)
    INTO v_market_average, v_market_min, v_market_max
    FROM latest_scans;

    v_market_average := ROUND(COALESCE(v_market_average, 0.0), 2);
    v_market_min := ROUND(COALESCE(v_market_min, 0.0), 2);
    v_market_max := ROUND(COALESCE(v_market_max, 0.0), 2);

    -- Get min/max hotel details
    SELECT jsonb_build_object('name', h.name, 'price', ls.converted_price) INTO v_min_hotel
    FROM temp_matched_logs ls
    JOIN temp_filtered_hotels h ON ls.hotel_id = h.hotel_id
    WHERE ls.converted_price = v_market_min
    ORDER BY ls.recorded_at DESC
    LIMIT 1;

    SELECT jsonb_build_object('name', h.name, 'price', ls.converted_price) INTO v_max_hotel
    FROM temp_matched_logs ls
    JOIN temp_filtered_hotels h ON ls.hotel_id = h.hotel_id
    WHERE ls.converted_price = v_market_max
    ORDER BY ls.recorded_at DESC
    LIMIT 1;

    -- all_hotels list
    SELECT jsonb_agg(jsonb_build_object('id', hotel_id, 'name', name, 'is_target', (hotel_id = v_target_hotel_id))) INTO v_all_hotels
    FROM temp_filtered_hotels;

    -- competitors list
    SELECT jsonb_agg(jsonb_build_object('id', hotel_id, 'name', name, 'is_target', false)) INTO v_competitors
    FROM temp_filtered_hotels
    WHERE hotel_id <> v_target_hotel_id;

    -- Calculate rank
    SELECT COALESCE(
        (SELECT (item->>'rank')::int 
         FROM jsonb_array_elements(
             CASE 
                 WHEN v_price_rank_list IS NOT NULL AND jsonb_typeof(v_price_rank_list) = 'array' THEN v_price_rank_list
                 ELSE '[]'::jsonb
             END
         ) AS item 
         WHERE (item->>'id')::uuid = v_target_hotel_id), 
        1
    ) INTO v_competitive_rank;

    -- Indexes calculations
    IF v_target_price IS NOT NULL AND v_market_average > 0 THEN
        v_ari_val := ROUND((v_target_price / v_market_average) * 100.0, 1);
    ELSE
        v_ari_val := 100.0;
    END IF;

    IF v_target_sentiment IS NOT NULL AND v_avg_sent_val > 0 THEN
        v_sent_val := ROUND((v_target_sentiment / v_avg_sent_val) * 100.0, 1);
    ELSE
        v_sent_val := 100.0;
    END IF;

    -- Quadrant Label
    IF v_target_price IS NULL OR v_target_sentiment IS NULL THEN
        v_quadrant_label := 'Insufficient Data';
    ELSE
        IF v_ari_val >= 100.0 AND v_sent_val >= 100.0 THEN
            v_quadrant_label := 'Premium King';
        ELSIF v_ari_val < 100.0 AND v_sent_val >= 100.0 THEN
            v_quadrant_label := 'Value Leader';
        ELSIF v_ari_val >= 100.0 AND v_sent_val < 100.0 THEN
            v_quadrant_label := 'Danger Zone';
        ELSE
            v_quadrant_label := 'Economy';
        END IF;
    END IF;

    -- Timelines for rate charts
    WITH stay_dates AS (
        SELECT DISTINCT check_in_date FROM temp_matched_logs
    ),
    daily_target AS (
        SELECT DISTINCT ON (check_in_date)
            check_in_date,
            check_out_date,
            converted_price AS target_price,
            is_historical
        FROM temp_matched_logs
        WHERE hotel_id = v_target_hotel_id
        ORDER BY check_in_date, recorded_at DESC
    ),
    daily_comps AS (
        SELECT 
            check_in_date,
            AVG(converted_price) AS comp_avg,
            jsonb_agg(
                jsonb_build_object(
                    'name', (SELECT name FROM temp_filtered_hotels h WHERE h.hotel_id = l.hotel_id),
                    'price', converted_price,
                    'intraday_events', (
                        SELECT COALESCE(jsonb_agg(
                            jsonb_build_object(
                                'price', le.converted_price,
                                'recorded_at', le.recorded_at,
                                'vendor', le.vendor,
                                'label', le.event_label
                            )
                        ), '[]'::jsonb)
                        FROM temp_matched_logs le
                        WHERE le.hotel_id = l.hotel_id AND le.check_in_date = l.check_in_date
                    )
                )
            ) AS competitors_json
        FROM (
            SELECT DISTINCT ON (hotel_id, check_in_date)
                hotel_id,
                check_in_date,
                converted_price
            FROM temp_matched_logs
            WHERE hotel_id <> v_target_hotel_id
            ORDER BY hotel_id, check_in_date, recorded_at DESC
        ) l
        GROUP BY check_in_date
    ),
    daily_prices_summary AS (
        SELECT 
            sd.check_in_date AS date,
            dt.check_out_date,
            COALESCE(dt.target_price, 0.0) AS target_price_raw,
            ROUND(COALESCE(dc.comp_avg, 0.0), 2) AS comp_avg,
            COALESCE(dc.competitors_json, '[]'::jsonb) AS competitors,
            (
                SELECT COALESCE(jsonb_agg(
                    jsonb_build_object(
                        'price', le.converted_price,
                        'recorded_at', le.recorded_at,
                        'vendor', le.vendor,
                        'label', le.event_label
                    )
                ), '[]'::jsonb)
                FROM temp_matched_logs le
                WHERE le.hotel_id = v_target_hotel_id
                  AND le.check_in_date = sd.check_in_date
            ) AS target_intraday_events,
            COALESCE(dt.is_historical, false) AS is_historical
        FROM stay_dates sd
        LEFT JOIN daily_target dt ON sd.check_in_date = dt.check_in_date
        LEFT JOIN daily_comps dc ON sd.check_in_date = dc.check_in_date
        ORDER BY sd.check_in_date ASC
    )
    SELECT 
        jsonb_agg(
            jsonb_build_object(
                'date', date,
                'check_out_date', check_out_date,
                'price', CASE 
                    WHEN target_price_raw <= 0 AND NOT v_is_premium THEN comp_avg
                    ELSE target_price_raw
                END,
                'comp_avg', comp_avg,
                'vs_comp', CASE 
                    WHEN (CASE WHEN target_price_raw <= 0 AND NOT v_is_premium THEN comp_avg ELSE target_price_raw END) > 0 AND comp_avg > 0 THEN
                        ROUND((((CASE WHEN target_price_raw <= 0 AND NOT v_is_premium THEN comp_avg ELSE target_price_raw END) - comp_avg) / comp_avg * 100.0), 1)
                    ELSE 0.0
                END,
                'competitors', competitors,
                'intraday_events', target_intraday_events,
                'is_historical', is_historical
            )
        )
    INTO v_daily_prices
    FROM daily_prices_summary;

    -- target_history
    WITH stay_dates AS (
        SELECT DISTINCT check_in_date FROM temp_matched_logs
    ),
    daily_target AS (
        SELECT DISTINCT ON (check_in_date)
            check_in_date,
            converted_price AS target_price
        FROM temp_matched_logs
        WHERE hotel_id = v_target_hotel_id
        ORDER BY check_in_date, recorded_at DESC
    ),
    daily_comps AS (
        SELECT 
            check_in_date,
            AVG(converted_price) AS comp_avg
        FROM (
            SELECT DISTINCT ON (hotel_id, check_in_date)
                hotel_id,
                check_in_date,
                converted_price
            FROM temp_matched_logs
            WHERE hotel_id <> v_target_hotel_id
            ORDER BY hotel_id, check_in_date, recorded_at DESC
        ) l
        GROUP BY check_in_date
    ),
    daily_prices_summary AS (
        SELECT 
            sd.check_in_date AS date,
            COALESCE(dt.target_price, 0.0) AS target_price_raw,
            COALESCE(dc.comp_avg, 0.0) AS comp_avg
        FROM stay_dates sd
        LEFT JOIN daily_target dt ON sd.check_in_date = dt.check_in_date
        LEFT JOIN daily_comps dc ON sd.check_in_date = dc.check_in_date
    )
    SELECT 
        COALESCE(jsonb_agg(
            jsonb_build_object(
                'price', CASE 
                    WHEN target_price_raw <= 0 AND NOT v_is_premium THEN comp_avg
                    ELSE target_price_raw
                END,
                'recorded_at', date
            ) ORDER BY date DESC
        ), '[]'::jsonb)
    INTO v_price_history
    FROM daily_prices_summary;

    -- Available Room types
    WITH room_names AS (
        SELECT DISTINCT trim(rt->>'name') AS rname
        FROM (
            SELECT pl.room_types
            FROM public.price_logs pl
            WHERE pl.hotel_id IN (SELECT hotel_id FROM temp_filtered_hotels)
            ORDER BY pl.recorded_at DESC
            LIMIT 300
        ) sub,
        LATERAL jsonb_array_elements(
            CASE 
                WHEN sub.room_types IS NOT NULL AND jsonb_typeof(sub.room_types) = 'array' THEN sub.room_types
                ELSE '[]'::jsonb
            END
        ) rt
        WHERE rt IS NOT NULL AND jsonb_typeof(rt) = 'object' AND rt->>'name' IS NOT NULL AND trim(rt->>'name') <> ''
    ),
    all_rooms AS (
        SELECT rname FROM room_names
        UNION
        SELECT 'Standard'
        UNION
        SELECT 'Deluxe'
        UNION
        SELECT 'Suite'
    )
    SELECT jsonb_agg(rname ORDER BY rname) INTO v_available_room_types
    FROM all_rooms;

    v_advisory_keys := '[]'::jsonb;
    IF v_ari_val < 90 THEN
        v_advisory_keys := v_advisory_keys || '"underpriced"'::jsonb;
    END IF;
    IF v_ari_val > 110 THEN
        v_advisory_keys := v_advisory_keys || '"overpriced"'::jsonb;
    END IF;
    IF v_sent_val > 105 THEN
        v_advisory_keys := v_advisory_keys || '"strong_sentiment"'::jsonb;
    END IF;

    RETURN jsonb_build_object(
        'hotel_id', v_target_hotel_id,
        'hotel_name', v_target_hotel_name,
        'market_average', v_market_average,
        'market_avg', v_market_average,
        'target_price', v_target_price,
        'market_min', v_market_min,
        'market_max', v_market_max,
        'min_hotel', COALESCE(v_min_hotel, '{"name": "N/A", "price": 0.0}'::jsonb),
        'max_hotel', COALESCE(v_max_hotel, '{"name": "N/A", "price": 0.0}'::jsonb),
        'all_hotels', COALESCE(v_all_hotels, '[]'::jsonb),
        'competitors', COALESCE(v_competitors, '[]'::jsonb),
        'total_hotels', v_total_hotels,
        'total_competitors', v_total_competitors,
        'available_room_types', COALESCE(v_available_room_types, '[]'::jsonb),
        'competitive_rank', v_competitive_rank,
        'market_rank', v_competitive_rank,
        'ari', v_ari_val,
        'sent_index', v_sent_val,
        'sentiment_index', v_sent_val,
        'sentiment_breakdown', COALESCE(v_sentiment_breakdown, '[]'::jsonb),
        'target_rating', v_target_sentiment,
        'market_rating', v_avg_sent_val,
        'quadrant_label', v_quadrant_label,
        'quadrant_x', v_ari_val,
        'quadrant_y', v_sent_val,
        'price_rank_list', COALESCE(v_price_rank_list, '[]'::jsonb),
        'price_history', COALESCE(v_price_history, '[]'::jsonb),
        'daily_prices', COALESCE(v_daily_prices, '[]'::jsonb),
        'advisory_keys', v_advisory_keys,
        'market_avg_scores', COALESCE(v_market_avg_scores, '{}'::jsonb),
        'pricing_dna', v_pricing_dna
    );
END;
$$;

-- COMMIT;
