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
