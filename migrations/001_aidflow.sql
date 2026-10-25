-- Auth.js @auth/pg-adapter 1.11.3 column names, with UUID identifiers.
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text, email text UNIQUE,
  "emailVerified" timestamptz, image text,
  role text NOT NULL DEFAULT 'USER' CHECK (role IN ('USER','ADMIN'))
);
CREATE TABLE accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), "userId" uuid NOT NULL REFERENCES users(id),
  type text NOT NULL, provider text NOT NULL CHECK(provider='google'), "providerAccountId" text NOT NULL,
  refresh_token text, access_token text, expires_at bigint, id_token text, scope text, session_state text, token_type text,
  UNIQUE(provider,"providerAccountId")
);
CREATE TABLE sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), "sessionToken" text UNIQUE NOT NULL,
  "userId" uuid NOT NULL REFERENCES users(id), expires timestamptz NOT NULL
);
CREATE TABLE verification_token (identifier text NOT NULL, token text NOT NULL, expires timestamptz NOT NULL, PRIMARY KEY(identifier,token));

CREATE TABLE campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), creator_user_id uuid REFERENCES users(id),
  slug text UNIQUE NOT NULL, title text NOT NULL, description text NOT NULL,
  disaster_type text NOT NULL, country text NOT NULL, region text NOT NULL,
  beneficiary_type text NOT NULL CHECK(beneficiary_type IN ('FAMILY','ORGANIZATION')),
  is_demo boolean NOT NULL DEFAULT true CHECK(is_demo), is_seeded boolean NOT NULL DEFAULT false,
  review_status text NOT NULL DEFAULT 'SUBMITTED' CHECK(review_status IN ('DRAFT','SUBMITTED','UNDER_REVIEW','NEEDS_CHANGES','APPROVED','REJECTED')),
  fundraising_status text NOT NULL DEFAULT 'NOT_READY' CHECK(fundraising_status IN ('NOT_READY','ACTIVE','PAUSED','COMPLETED')),
  requested_budget_currency text, requested_budget_amount_minor bigint CHECK(requested_budget_amount_minor >= 0),
  xlm_goal_stroops bigint NOT NULL DEFAULT 10000000000 CHECK(xlm_goal_stroops > 0),
  consent_attested boolean NOT NULL DEFAULT false, active_config_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK(fundraising_status <> 'ACTIVE' OR (review_status='APPROVED' AND is_seeded AND active_config_id IS NOT NULL))
);
CREATE UNIQUE INDEX one_seed_campaign ON campaigns(is_seeded) WHERE is_seeded;
CREATE TABLE campaign_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), campaign_id uuid NOT NULL REFERENCES campaigns(id),
  admin_user_id uuid NOT NULL REFERENCES users(id), decision text NOT NULL,
  reason text NOT NULL CHECK(length(reason) BETWEEN 3 AND 2000), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE campaign_payment_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), campaign_id uuid NOT NULL REFERENCES campaigns(id),
  version integer NOT NULL CHECK(version > 0), network text NOT NULL DEFAULT 'testnet' CHECK(network='testnet'),
  asset text NOT NULL DEFAULT 'XLM' CHECK(asset='XLM'), deployment_uuid uuid NOT NULL,
  trigger_contract text NOT NULL CHECK(trigger_contract ~ '^C[A-Z2-7]{55}$'),
  split_contract text NOT NULL CHECK(split_contract ~ '^C[A-Z2-7]{55}$'),
  relief_address text NOT NULL CHECK(relief_address ~ '^G[A-Z2-7]{55}$'),
  logistics_address text NOT NULL CHECK(logistics_address ~ '^G[A-Z2-7]{55}$'),
  relief_bps integer NOT NULL DEFAULT 9000 CHECK(relief_bps=9000),
  logistics_bps integer NOT NULL DEFAULT 1000 CHECK(logistics_bps=1000),
  ready boolean NOT NULL DEFAULT false, verification_hash text CHECK(verification_hash ~ '^[a-f0-9]{64}$'),
  activated_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(campaign_id,version), UNIQUE(campaign_id,id), CHECK(relief_address <> logistics_address),
  CHECK(NOT ready OR (verification_hash IS NOT NULL AND activated_at IS NOT NULL))
);
ALTER TABLE campaigns ADD CONSTRAINT campaign_config_binding FOREIGN KEY(id,active_config_id)
  REFERENCES campaign_payment_configs(campaign_id,id) DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE donation_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), donor_user_id uuid NOT NULL REFERENCES users(id),
  campaign_id uuid NOT NULL REFERENCES campaigns(id), payment_config_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'CREATED' CHECK(status IN ('CREATED','PREPARING','PREPARED','AWAITING_SIGNATURE','SUBMITTED','PENDING_VERIFICATION','SUCCESS','CONFIRMED_FAILED','NEEDS_OPERATOR_REVIEW')),
  amount_stroops bigint NOT NULL DEFAULT 10000000 CHECK(amount_stroops=10000000),
  asset text NOT NULL DEFAULT 'XLM' CHECK(asset='XLM'), network text NOT NULL DEFAULT 'testnet' CHECK(network='testnet'),
  wallet_address text NOT NULL CHECK(wallet_address ~ '^G[A-Z2-7]{55}$'),
  idempotency_key text NOT NULL CHECK(length(idempotency_key) BETWEEN 1 AND 100), snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(donor_user_id,idempotency_key),
  FOREIGN KEY(campaign_id,payment_config_id) REFERENCES campaign_payment_configs(campaign_id,id)
);
CREATE UNIQUE INDEX one_unresolved_donation ON donation_orders(donor_user_id,campaign_id,wallet_address)
  WHERE status NOT IN ('SUCCESS','CONFIRMED_FAILED');
CREATE INDEX donor_history ON donation_orders(donor_user_id,created_at DESC);
CREATE TABLE blockchain_payments (
  order_id uuid PRIMARY KEY REFERENCES donation_orders(id), preparation jsonb, unsigned_xdr text,
  network_passphrase text CHECK(network_passphrase='Test SDF Network ; September 2015'),
  signed_xdr text, tx_hash text UNIQUE CHECK(tx_hash ~ '^[a-f0-9]{64}$'),
  preparation_request_id text, prepare_started_at timestamptz, submit_started_at timestamptz,
  submission_status text, verified_at timestamptz, ledger bigint,
  CHECK(signed_xdr IS NULL OR (unsigned_xdr IS NOT NULL AND tx_hash IS NOT NULL))
);
CREATE TABLE payout_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid NOT NULL REFERENCES donation_orders(id),
  tx_hash text NOT NULL CHECK(tx_hash ~ '^[a-f0-9]{64}$'), recipient text NOT NULL,
  amount_stroops bigint NOT NULL CHECK(amount_stroops > 0), asset text NOT NULL CHECK(asset='XLM'),
  evidence_id text NOT NULL, ledger bigint NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(order_id,evidence_id), UNIQUE(order_id,recipient)
);
CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_user_id uuid REFERENCES users(id),
  action text NOT NULL, entity_id uuid, metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE request_budgets (
  bucket text PRIMARY KEY, starts_at timestamptz NOT NULL, used integer NOT NULL CHECK(used > 0)
);

CREATE FUNCTION protect_order() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.donor_user_id,NEW.campaign_id,NEW.payment_config_id,NEW.amount_stroops,NEW.asset,NEW.network,NEW.wallet_address,NEW.idempotency_key,NEW.snapshot)
    IS DISTINCT FROM (OLD.donor_user_id,OLD.campaign_id,OLD.payment_config_id,OLD.amount_stroops,OLD.asset,OLD.network,OLD.wallet_address,OLD.idempotency_key,OLD.snapshot)
    THEN RAISE EXCEPTION 'Order financial bindings are immutable'; END IF;
  IF OLD.status IN ('SUCCESS','CONFIRMED_FAILED') AND NEW.status <> OLD.status
    THEN RAISE EXCEPTION 'Final orders cannot reopen'; END IF;
  IF NEW.status='SUCCESS' AND OLD.status <> 'SUCCESS' AND NOT EXISTS (
    SELECT 1 FROM blockchain_payments p WHERE p.order_id=NEW.id AND p.verified_at IS NOT NULL
      AND (SELECT count(*) FROM payout_evidence e WHERE e.order_id=NEW.id AND e.tx_hash=p.tx_hash AND e.asset='XLM')=2
      AND EXISTS(SELECT 1 FROM payout_evidence e WHERE e.order_id=NEW.id AND e.tx_hash=p.tx_hash AND e.recipient=NEW.snapshot->>'reliefAddress' AND e.amount_stroops=9000000)
      AND EXISTS(SELECT 1 FROM payout_evidence e WHERE e.order_id=NEW.id AND e.tx_hash=p.tx_hash AND e.recipient=NEW.snapshot->>'logisticsAddress' AND e.amount_stroops=1000000)
  ) THEN RAISE EXCEPTION 'Exact verified payouts required'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER immutable_order BEFORE UPDATE ON donation_orders FOR EACH ROW EXECUTE FUNCTION protect_order();
CREATE FUNCTION protect_payment() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (OLD.preparation IS NOT NULL AND NEW.preparation IS DISTINCT FROM OLD.preparation)
    OR (OLD.tx_hash IS NOT NULL AND NEW.tx_hash IS DISTINCT FROM OLD.tx_hash)
    OR (OLD.signed_xdr IS NOT NULL AND NEW.signed_xdr IS DISTINCT FROM OLD.signed_xdr)
    OR (OLD.unsigned_xdr IS NOT NULL AND NEW.unsigned_xdr IS DISTINCT FROM OLD.unsigned_xdr)
    OR (OLD.network_passphrase IS NOT NULL AND NEW.network_passphrase IS DISTINCT FROM OLD.network_passphrase)
    OR (OLD.preparation_request_id IS NOT NULL AND NEW.preparation_request_id IS DISTINCT FROM OLD.preparation_request_id)
    THEN RAISE EXCEPTION 'Original payment evidence cannot be replaced'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER immutable_payment BEFORE UPDATE ON blockchain_payments FOR EACH ROW EXECUTE FUNCTION protect_payment();
CREATE FUNCTION protect_config() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.ready THEN RAISE EXCEPTION 'Verified payment configurations are immutable; create a new version'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER immutable_config BEFORE UPDATE OR DELETE ON campaign_payment_configs FOR EACH ROW EXECUTE FUNCTION protect_config();
CREATE FUNCTION append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Audit and receipt evidence are append-only'; END $$;
CREATE TRIGGER audit_append_only BEFORE UPDATE OR DELETE ON audit_logs FOR EACH ROW EXECUTE FUNCTION append_only();
CREATE TRIGGER review_append_only BEFORE UPDATE OR DELETE ON campaign_reviews FOR EACH ROW EXECUTE FUNCTION append_only();
CREATE TRIGGER evidence_append_only BEFORE UPDATE OR DELETE ON payout_evidence FOR EACH ROW EXECUTE FUNCTION append_only();
