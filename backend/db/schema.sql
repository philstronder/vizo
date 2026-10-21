-- VIZO database schema (PostgreSQL / Amazon RDS)
-- Run with: npm run db:migrate (safe to re-run)

CREATE EXTENSION IF NOT EXISTS pgcrypto; -- for gen_random_uuid()

CREATE TABLE IF NOT EXISTS users (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL,
  email             TEXT NOT NULL UNIQUE,
  password_hash     TEXT NOT NULL,
  building_name     TEXT NOT NULL,
  unit_number       TEXT NOT NULL,
  verified          BOOLEAN NOT NULL DEFAULT FALSE,
  verification_photo_key TEXT, -- S3 object key for the uploaded proof-of-residency photo
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$ BEGIN
  CREATE TYPE listing_type AS ENUM ('direct', 'auction');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE listing_condition AS ENUM ('new', 'used-excellent', 'used-good');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE listing_status AS ENUM ('active', 'sold', 'ended', 'draft');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE listing_category AS ENUM ('furniture', 'electronics', 'books', 'plants', 'other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS listings (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title             TEXT NOT NULL,
  description       TEXT NOT NULL,
  category          listing_category NOT NULL,
  condition         listing_condition NOT NULL,
  type              listing_type NOT NULL,
  status            listing_status NOT NULL DEFAULT 'active',
  images            TEXT[] NOT NULL DEFAULT '{}', -- S3 object keys

  -- direct sale
  price             NUMERIC(10, 2),

  -- auction
  starting_price    NUMERIC(10, 2),
  current_bid       NUMERIC(10, 2),
  max_bidder_id     UUID REFERENCES users(id),
  auction_ends_at   TIMESTAMPTZ,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT direct_sale_has_price
    CHECK (type <> 'direct' OR price IS NOT NULL),
  CONSTRAINT auction_has_starting_price
    CHECK (type <> 'auction' OR starting_price IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_listings_status ON listings(status);
CREATE INDEX IF NOT EXISTS idx_listings_seller ON listings(seller_id);
CREATE INDEX IF NOT EXISTS idx_listings_category ON listings(category);

CREATE TABLE IF NOT EXISTS bids (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id        UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  bidder_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount            NUMERIC(10, 2) NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bids_listing ON bids(listing_id, created_at DESC);

CREATE TABLE IF NOT EXISTS messages (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id        UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  author_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body              TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_listing ON messages(listing_id, created_at);

DO $$ BEGIN
  CREATE TYPE order_status AS ENUM ('pending_pickup', 'ready_for_pickup', 'shipped', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS orders (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id        UUID NOT NULL REFERENCES listings(id),
  buyer_id          UUID NOT NULL REFERENCES users(id),
  seller_id         UUID NOT NULL REFERENCES users(id),
  price             NUMERIC(10, 2) NOT NULL,
  fees              NUMERIC(10, 2) NOT NULL DEFAULT 0,
  status            order_status NOT NULL DEFAULT 'pending_pickup',
  pickup_location   TEXT,
  pickup_time       TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_buyer ON orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_orders_seller ON orders(seller_id);

DO $$ BEGIN
  CREATE TYPE notification_type AS ENUM ('new_bid', 'sold', 'message', 'outbid', 'listing_ending', 'order_completed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
-- Keeps databases created before 'order_completed' existed in sync.
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'order_completed';

CREATE TABLE IF NOT EXISTS notifications (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type              notification_type NOT NULL,
  title             TEXT NOT NULL,
  body              TEXT NOT NULL,
  href              TEXT,
  read              BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC);

-- One rating per order, left by the buyer once the order is completed.
CREATE TABLE IF NOT EXISTS seller_reviews (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id          UUID NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  seller_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  buyer_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating            SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment           TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_seller_reviews_seller ON seller_reviews(seller_id);

-- Admins create, edit and delete stores. Promote a user with:
--   npm run user:make-admin -- someone@example.com
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;

-- A store belongs to one TV show. Its QR code (shown on air) opens the store
-- in the app, where anyone — signed in or not — can browse its products.
-- Deleting a store soft-deletes it (deleted_at) because its listings may
-- already be referenced by orders.
CREATE TABLE IF NOT EXISTS stores (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL,
  description       TEXT NOT NULL DEFAULT '',
  created_by        UUID NOT NULL REFERENCES users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);

-- Listings with a store_id are store products; listings without one belong
-- to the seller's building community.
ALTER TABLE listings ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id);
CREATE INDEX IF NOT EXISTS idx_listings_store ON listings(store_id);

-- Units left to sell. Community listings are single items; store products can
-- stock several. Checkout takes one unit and marks the listing sold at 0, and
-- admins restock sold-out store products to put them back on sale.
ALTER TABLE listings ADD COLUMN IF NOT EXISTS quantity INTEGER NOT NULL DEFAULT 1;
DO $$ BEGIN
  ALTER TABLE listings ADD CONSTRAINT listing_quantity_not_negative CHECK (quantity >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
-- Listings sold before the column existed were single items; leave none of them in stock.
UPDATE listings SET quantity = 0 WHERE status = 'sold' AND quantity > 0;

-- TV show viewers sign up from a store with a phone and a delivery address
-- instead of a building. An account without a building only shops in TV
-- stores; adding a building and unit in the profile joins that community.
ALTER TABLE users ALTER COLUMN building_name DROP NOT NULL;
ALTER TABLE users ALTER COLUMN unit_number DROP NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS address_postal_code TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS address_street TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS address_number TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS address_complement TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS address_district TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS address_city TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS address_state TEXT;
