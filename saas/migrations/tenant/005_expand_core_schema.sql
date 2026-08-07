-- Expand tenant schema to include core app tables used by nutrition, workouts, commerce, and tracking flows.

-- Workouts
CREATE TABLE IF NOT EXISTS workouts (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    duration INTEGER NOT NULL,
    difficulty TEXT NOT NULL,
    type TEXT NOT NULL,
    coach_id INTEGER NOT NULL REFERENCES users(id),
    exercises JSON NOT NULL
);

-- Scheduled user workouts
CREATE TABLE IF NOT EXISTS user_workouts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    workout_id INTEGER NOT NULL REFERENCES workouts(id),
    scheduled_for TIMESTAMP NOT NULL,
    completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_user_workouts_user ON user_workouts(user_id);
CREATE INDEX IF NOT EXISTS idx_user_workouts_workout ON user_workouts(workout_id);

-- Workout sessions log
CREATE TABLE IF NOT EXISTS workout_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    workout_id INTEGER REFERENCES workouts(id),
    workout_name TEXT NOT NULL,
    workout_type TEXT NOT NULL,
    completed_at TIMESTAMP NOT NULL DEFAULT NOW(),
    duration INTEGER,
    total_sets INTEGER DEFAULT 0,
    completed_sets INTEGER DEFAULT 0,
    exercises JSON,
    notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_workout_sessions_user ON workout_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_workout_sessions_workout ON workout_sessions(workout_id);

-- Meals
CREATE TABLE IF NOT EXISTS meals (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    calories INTEGER NOT NULL,
    proteins REAL NOT NULL,
    carbs REAL NOT NULL,
    fats REAL NOT NULL,
    fiber REAL,
    date TIMESTAMP NOT NULL,
    food_items JSON
);
CREATE INDEX IF NOT EXISTS idx_meals_user ON meals(user_id);
CREATE INDEX IF NOT EXISTS idx_meals_date ON meals(date);

-- Food items catalogue
CREATE TABLE IF NOT EXISTS food_items (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    name_ar TEXT,
    brand TEXT,
    brand_ar TEXT,
    calories REAL NOT NULL,
    proteins REAL NOT NULL,
    carbs REAL NOT NULL,
    fats REAL NOT NULL,
    fiber REAL NOT NULL,
    serving_size TEXT NOT NULL,
    serving_size_grams REAL NOT NULL,
    category TEXT NOT NULL,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_food_items_name ON food_items(name);

-- Progress tracking
CREATE TABLE IF NOT EXISTS progress (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    date TIMESTAMP NOT NULL,
    weight REAL,
    calories_consumed INTEGER,
    calories_burned INTEGER,
    steps INTEGER,
    water_glasses INTEGER,
    notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_progress_user ON progress(user_id);
CREATE INDEX IF NOT EXISTS idx_progress_date ON progress(date);

-- Products
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    price REAL NOT NULL,
    image_url TEXT,
    category TEXT NOT NULL,
    rating REAL,
    review_count INTEGER,
    stock INTEGER NOT NULL
);

-- Orders
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    status TEXT NOT NULL DEFAULT 'pending',
    total REAL NOT NULL,
    currency TEXT NOT NULL DEFAULT 'EGP',
    payment_method TEXT NOT NULL DEFAULT 'card',
    payment_status TEXT NOT NULL DEFAULT 'pending',
    shipping_address TEXT,
    shipping_city TEXT,
    shipping_country TEXT,
    shipping_phone TEXT,
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);

-- Order items
CREATE TABLE IF NOT EXISTS order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id),
    product_name TEXT NOT NULL,
    product_price REAL NOT NULL,
    product_image_url TEXT,
    quantity INTEGER NOT NULL DEFAULT 1,
    subtotal REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);

-- Cart items
CREATE TABLE IF NOT EXISTS cart_items (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT cart_items_user_product_idx UNIQUE (user_id, product_id)
);
CREATE INDEX IF NOT EXISTS cart_items_user_idx ON cart_items(user_id);
CREATE INDEX IF NOT EXISTS cart_items_product_idx ON cart_items(product_id);

-- Messages
CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    sender_id INTEGER NOT NULL REFERENCES users(id),
    receiver_id INTEGER NOT NULL REFERENCES users(id),
    content TEXT NOT NULL,
    sent_at TIMESTAMP NOT NULL DEFAULT NOW(),
    read BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id);

-- Daily stats
CREATE TABLE IF NOT EXISTS daily_stats (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    date TIMESTAMP NOT NULL,
    calories INTEGER DEFAULT 0,
    calories_goal INTEGER DEFAULT 2200,
    protein REAL DEFAULT 0,
    protein_goal REAL DEFAULT 140,
    carbs REAL DEFAULT 0,
    carbs_goal REAL DEFAULT 240,
    fat REAL DEFAULT 0,
    fat_goal REAL DEFAULT 60,
    fiber REAL DEFAULT 0,
    fiber_goal REAL DEFAULT 30,
    steps INTEGER DEFAULT 0,
    steps_goal INTEGER DEFAULT 10000,
    water INTEGER DEFAULT 0,
    water_goal INTEGER DEFAULT 8
);
CREATE INDEX IF NOT EXISTS idx_daily_stats_user ON daily_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_stats_date ON daily_stats(date);

-- User plans
CREATE TABLE IF NOT EXISTS user_plans (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    coach_id INTEGER NOT NULL REFERENCES users(id),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    weekly_focus TEXT,
    goals JSON,
    weekly_schedule JSON,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_plans_user ON user_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_user_plans_coach ON user_plans(coach_id);

-- Credit balances
CREATE TABLE IF NOT EXISTS credit_balances (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    total_credits REAL NOT NULL DEFAULT 0,
    last_deduction_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Credit transactions
CREATE TABLE IF NOT EXISTS credit_transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    merchant_reference_id TEXT NOT NULL UNIQUE,
    session_id TEXT,
    order_id TEXT,
    payment_gateway TEXT NOT NULL DEFAULT 'stripe',
    status TEXT NOT NULL DEFAULT 'pending',
    gateway_status TEXT,
    response_code TEXT,
    amount REAL NOT NULL,
    currency TEXT NOT NULL DEFAULT 'EGP',
    credits INTEGER NOT NULL,
    checkout_url TEXT,
    return_url TEXT,
    callback_url TEXT,
    request_payload JSON,
    session_payload JSON,
    callback_payload JSON,
    signature_valid BOOLEAN DEFAULT FALSE,
    signature_header TEXT,
    error_message TEXT,
    credited BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS credit_transactions_session_id_key ON credit_transactions(session_id);
CREATE UNIQUE INDEX IF NOT EXISTS credit_transactions_merchant_ref_key ON credit_transactions(merchant_reference_id);
CREATE INDEX IF NOT EXISTS credit_transactions_user_idx ON credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS credit_transactions_status_idx ON credit_transactions(status);

-- Tracking settings (single row)
CREATE TABLE IF NOT EXISTS tracking_settings (
    id SERIAL PRIMARY KEY,
    meta_pixel_id TEXT,
    meta_pixel_access_token TEXT,
    meta_pixel_test_event_code TEXT,
    google_ads_conversion_id TEXT,
    google_ads_conversion_label TEXT,
    google_ads_send_to TEXT,
    google_analytics_measurement_id TEXT,
    google_analytics_api_secret TEXT,
    google_analytics_stream_id TEXT,
    google_analytics_property_id TEXT,
    updated_by_user_id INTEGER REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- User points and streaks
CREATE TABLE IF NOT EXISTS user_points_and_streaks (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
    total_points INTEGER NOT NULL DEFAULT 0,
    current_streak INTEGER NOT NULL DEFAULT 0,
    longest_streak INTEGER NOT NULL DEFAULT 0,
    last_activity_date TIMESTAMP,
    last_breakfast_log_date TIMESTAMP,
    last_lunch_log_date TIMESTAMP,
    last_dinner_log_date TIMESTAMP,
    last_snack_log_date TIMESTAMP,
    snack_logs_today INTEGER NOT NULL DEFAULT 0,
    last_workout_log_date TIMESTAMP,
    last_weight_log_date TIMESTAMP,
    last_store_purchase_date TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- User logins
CREATE TABLE IF NOT EXISTS user_logins (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    login_at TIMESTAMP NOT NULL DEFAULT NOW(),
    ip_address TEXT,
    user_agent TEXT
);
CREATE INDEX IF NOT EXISTS idx_user_logins_user ON user_logins(user_id);
CREATE INDEX IF NOT EXISTS idx_user_logins_login_at ON user_logins(login_at);

-- Coach info
CREATE TABLE IF NOT EXISTS coach_info (
    id SERIAL PRIMARY KEY,
    coach_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
    about_me TEXT,
    qualifications TEXT,
    certificate_images TEXT[],
    training_approach TEXT,
    success_stories TEXT,
    services_and_programs TEXT,
    contact TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Coach products
CREATE TABLE IF NOT EXISTS coach_products (
    id SERIAL PRIMARY KEY,
    coach_id INTEGER NOT NULL REFERENCES users(id),
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    description TEXT,
    thumbnail_url TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_coach_products_coach ON coach_products(coach_id);

-- Affiliate products
CREATE TABLE IF NOT EXISTS affiliate_products (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    description TEXT,
    thumbnail_url TEXT,
    category TEXT,
    source TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    last_scraped_at TIMESTAMP,
    scrape_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_affiliate_products_category ON affiliate_products(category);
CREATE INDEX IF NOT EXISTS idx_affiliate_products_source ON affiliate_products(source);

-- Affiliate categories
CREATE TABLE IF NOT EXISTS affiliate_categories (
    id SERIAL PRIMARY KEY,
    name_en TEXT NOT NULL UNIQUE,
    name_ar TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Scraped affiliate products
CREATE TABLE IF NOT EXISTS scraped_affiliate_products (
    id SERIAL PRIMARY KEY,
    affiliate_product_id INTEGER NOT NULL REFERENCES affiliate_products(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    price TEXT,
    original_price TEXT,
    discount TEXT,
    rating REAL,
    review_count INTEGER,
    image_url TEXT,
    product_url TEXT NOT NULL,
    availability TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_scraped_affiliate_products_product ON scraped_affiliate_products(affiliate_product_id);

-- Product clicks
CREATE TABLE IF NOT EXISTS product_clicks (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    affiliate_product_id INTEGER NOT NULL REFERENCES affiliate_products(id) ON DELETE CASCADE,
    clicked_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_product_clicks_user ON product_clicks(user_id);
CREATE INDEX IF NOT EXISTS idx_product_clicks_affiliate ON product_clicks(affiliate_product_id);
