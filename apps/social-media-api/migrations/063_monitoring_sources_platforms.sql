-- Expand monitoring_profile source constraint to include international agencies
ALTER TABLE monitoring_profile DROP CONSTRAINT IF EXISTS chk_monitoring_source;
ALTER TABLE monitoring_profile ADD CONSTRAINT chk_monitoring_source
  CHECK (source IN ('MANUAL','NIDAAN','TEF','PRIVATE','BULK_CSV','UNODC','EUROPOL','INTERPOL','NCB','DEA','FATF'));

-- Expand platform constraint to include telegram, whatsapp, youtube
ALTER TABLE monitoring_profile DROP CONSTRAINT IF EXISTS monitoring_profile_platform_check;
ALTER TABLE monitoring_profile ADD CONSTRAINT monitoring_profile_platform_check
  CHECK (platform IN ('facebook','instagram','twitter','x','telegram','whatsapp','youtube'));
