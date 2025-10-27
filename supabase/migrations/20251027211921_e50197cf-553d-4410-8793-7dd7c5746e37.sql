-- Phase 1: Add performance indexes for frequently filtered columns

-- Index for status filtering (used in every query)
CREATE INDEX IF NOT EXISTS idx_addresses_status ON public.addresses(status);

-- Index for street name filtering (used in AddressList)
CREATE INDEX IF NOT EXISTS idx_addresses_street_name ON public.addresses(street_name);

-- Index for commune filtering (JSONB field used in AddressList)
CREATE INDEX IF NOT EXISTS idx_addresses_commune ON public.addresses USING GIN ((csv_data->'commune_nom'));

-- Composite index for filtered + paginated queries
CREATE INDEX IF NOT EXISTS idx_addresses_status_created ON public.addresses(status, created_at DESC);

-- Index for zone_id lookups
CREATE INDEX IF NOT EXISTS idx_addresses_zone_id ON public.addresses(zone_id) WHERE zone_id IS NOT NULL;

-- Index for last_visit_date to improve statistics queries
CREATE INDEX IF NOT EXISTS idx_addresses_last_visit ON public.addresses(last_visit_date) WHERE last_visit_date IS NOT NULL;