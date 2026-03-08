-- Seed ~12 Telangana-realistic monitoring profiles from various sources
INSERT INTO monitoring_profile (platform, entry_type, handle, priority, source, source_ref, suspect_name, notes)
VALUES
  ('instagram', 'PROFILE', '@ravi_hyd_420',      'HIGH',   'NIDAAN',   'NID-2024-00451',  'Ravi Kumar',      'NDPS Sec 20, Hyderabad'),
  ('twitter',   'PROFILE', '@deals_warangal',    'HIGH',   'NIDAAN',   'NID-2024-00523',  'Suresh Reddy',    'NDPS Sec 21, Warangal'),
  ('facebook',  'PROFILE', 'naatu.saara.kings',  'NORMAL', 'NIDAAN',   'NID-2023-01187',  'Mohammed Ismail', 'NDPS Sec 20, Karimnagar'),
  ('instagram', 'PROFILE', '@karimnagar_stuff',  'HIGH',   'TEF',      'TEF-TS-2024-0089','Unknown',         'Field unit tip, Karimnagar'),
  ('twitter',   'PROFILE', '@hyd_maal_supply',   'HIGH',   'TEF',      'TEF-TS-2024-0134','Unknown',         'SHO Medchal report'),
  ('facebook',  'PROFILE', 'belt.shop.adilabad', 'NORMAL', 'TEF',      'TEF-TS-2024-0201','Lakshmi Devi',    'Illicit liquor ring'),
  ('instagram', 'PROFILE', '@secbad_dealer',     'HIGH',   'PRIVATE',  'PRV-CI-0045',     'Confidential',    'CI source, Secunderabad'),
  ('x',         'PROFILE', '@nizamabad_gang',    'NORMAL', 'PRIVATE',  'PRV-CI-0067',     'Confidential',    'Gang activity tracking'),
  ('instagram', 'PROFILE', '@wgl_saruku',        'NORMAL', 'BULK_CSV', 'CSV-2024-03-01',  'Venkat Rao',      'Batch import Mar 2024'),
  ('twitter',   'PROFILE', '@adilabad_trader',   'LOW',    'BULK_CSV', 'CSV-2024-03-01',  'Ramesh Goud',     'Batch import Mar 2024'),
  ('facebook',  'PROFILE', 'khammam.drugs.watch','NORMAL', 'MANUAL',   NULL,              'Pradeep Singh',   'Manual entry by analyst'),
  ('instagram', 'PROFILE', '@medak_pills',       'LOW',    'MANUAL',   NULL,              'Unknown',         'Preliminary monitoring')
ON CONFLICT DO NOTHING;
