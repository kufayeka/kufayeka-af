DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname = 'create_hypertable'
  ) THEN
    PERFORM public.create_hypertable(
      'asset_attribute_historian'::regclass,
      'ts'::name,
      if_not_exists => TRUE,
      create_default_indexes => FALSE,
      chunk_time_interval => INTERVAL '17 days'
    );
  END IF;
END $$;
