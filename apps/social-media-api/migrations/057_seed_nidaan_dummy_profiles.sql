-- Seed ~12 Telangana-realistic monitoring profiles from various sources
INSERT INTO monitoring_profile (platform, entry_type, handle, priority, source, source_ref, suspect_name, notes, created_by)
VALUES
  ('instagram', 'PROFILE', '@ravi_hyd_420',      'HIGH',   'NIDAAN',   'NID-2024-00451',  'Ravi Kumar',      'NDPS Sec 20, Hyderabad',       'system'),
  ('twitter',   'PROFILE', '@deals_warangal',    'HIGH',   'NIDAAN',   'NID-2024-00523',  'Suresh Reddy',    'NDPS Sec 21, Warangal',        'system'),
  ('facebook',  'PROFILE', 'naatu.saara.kings',  'NORMAL', 'NIDAAN',   'NID-2023-01187',  'Mohammed Ismail', 'NDPS Sec 20, Karimnagar',      'system'),
  ('instagram', 'PROFILE', '@karimnagar_stuff',  'HIGH',   'TEF',      'TEF-TS-2024-0089','Unknown',         'Field unit tip, Karimnagar',   'system'),
  ('twitter',   'PROFILE', '@hyd_maal_supply',   'HIGH',   'TEF',      'TEF-TS-2024-0134','Unknown',         'SHO Medchal report',           'system'),
  ('facebook',  'PROFILE', 'belt.shop.adilabad', 'NORMAL', 'TEF',      'TEF-TS-2024-0201','Lakshmi Devi',    'Illicit liquor ring',          'system'),
  ('instagram', 'PROFILE', '@secbad_dealer',     'HIGH',   'PRIVATE',  'PRV-CI-0045',     'Confidential',    'CI source, Secunderabad',      'system'),
  ('x',         'PROFILE', '@nizamabad_gang',    'NORMAL', 'PRIVATE',  'PRV-CI-0067',     'Confidential',    'Gang activity tracking',       'system'),
  ('instagram', 'PROFILE', '@wgl_saruku',        'NORMAL', 'BULK_CSV', 'CSV-2024-03-01',  'Venkat Rao',      'Batch import Mar 2024',        'system'),
  ('twitter',   'PROFILE', '@adilabad_trader',   'LOW',    'BULK_CSV', 'CSV-2024-03-01',  'Ramesh Goud',     'Batch import Mar 2024',        'system'),
  ('facebook',  'PROFILE', 'khammam.drugs.watch','NORMAL', 'MANUAL',   NULL,              'Pradeep Singh',   'Manual entry by analyst',      'system'),
  ('instagram', 'PROFILE', '@medak_pills',       'LOW',    'MANUAL',   NULL,              'Unknown',         'Preliminary monitoring',       'system')
ON CONFLICT DO NOTHING;
