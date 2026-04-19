WITH updates (id, loc_code, resolved) AS (VALUES
('9d60b7b7-3be5-48d6-955b-514bbf404fc1'::uuid, 1012769, 'Bursa,Bursa,Turkiye'),
('1b098b8f-80ad-4d07-985b-bcee32c32554'::uuid, 21354, 'Adiyaman,Turkiye'),
('69b54e7c-335f-410d-921d-70e3063d4e78'::uuid, 21364, 'Edirne,Turkiye'),
('37f312a4-44d6-4e4c-9423-14e75db88e95'::uuid, 21069, 'Istanbul,Turkiye'),
('7f65a584-a417-4537-beb1-c97806147660'::uuid, 21068, 'Mersin,Turkiye'),
('c55ca6f7-c3f8-4f01-bbcf-03df72996c93'::uuid, 21094, 'Yalova,Turkiye'),
('37897c16-0776-4aec-a7b0-f81ae28b347e'::uuid, 21069, 'Istanbul,Turkiye'),
('5d5bad0b-3099-4214-b8b6-406ad075a0ae'::uuid, 21372, 'Rize,Turkiye'),
('f293c241-524d-4d3c-803e-6e7572ab7622'::uuid, 21069, 'Istanbul,Turkiye'),
('ae790b5a-55a6-42cb-8e92-0c6455198fe3'::uuid, 21088, 'Trabzon,Turkiye'),
('881cc8d4-d634-4f5f-93bd-50945028bec4'::uuid, 21087, 'Tekirdag,Turkiye'),
('15a9ad19-5323-41c2-beeb-d42e372604d5'::uuid, 21370, 'Mardin,Turkiye'),
('f6574817-992b-42c0-98e4-822e579c2e5f'::uuid, 9041083, 'Dubai,United Arab Emirates'),
('f6d5ee8a-8fc2-4f2c-96ed-1e26a7daf086'::uuid, 1021404, 'Las Vegas,Nevada,United States'),
('ee24f93b-a277-4b65-88c5-8a1febd543ed'::uuid, 9041083, 'Dubai,United Arab Emirates'),
('14bb056b-45b5-440f-bfed-475cbf4562b6'::uuid, 21082, 'Nevsehir,Turkiye'),
('6aa6f8e6-1ea5-4a4f-8845-2d72f6ae7611'::uuid, 21069, 'Istanbul,Turkiye'),
('90b920f0-392e-4e92-b60f-2990bd163675'::uuid, 21376, 'Usak,Turkiye'),
('bb1018c9-5e66-4ccd-afa0-853204b95a93'::uuid, 21080, 'Mugla,Turkiye'),
('4e9f7e96-86d8-4a09-8a16-d3bca3185468'::uuid, 21069, 'Istanbul,Turkiye'),
('84acbd17-02c3-48f3-af1e-c31f44760b44'::uuid, 1012769, 'Bursa,Bursa,Turkiye')
)
UPDATE hotel_directory h
SET location_code = u.loc_code, 
    resolved_location_name = u.resolved,
    location_verified = true
FROM updates u
WHERE h.id = u.id;