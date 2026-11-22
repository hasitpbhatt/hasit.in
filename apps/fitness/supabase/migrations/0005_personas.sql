-- Persona additive fields (no rewrite)
alter table profiles add column if not exists conditions text[] default '{}';
alter table profiles add column if not exists joint_issue boolean default false;
alter table profiles add column if not exists time_min int default 20;
alter table profiles add column if not exists equipment text default 'none';
alter table profiles add column if not exists sleep_hr int default 7;
alter table profiles add column if not exists family_cook boolean default true;
insert into foods (id,en,hi,gu,unit,kcal,protein_g,carbs_g,fat_g,fiber_g) values
('fafda','Fafda (100g)','फाफड़ा (100g)','ફાફડા (100g)','100g',380,9,40,20,4),
('fafda-jalebi','Fafda-jalebi combo capped (1 serve)','फाफड़ा-जलेबी (1)','ફાફડા-જલેબી (1)','serve',450,8,60,20,3),
('jalebi-fafda-weekly','Note: max 1x/week, log as treat','नोट: सप्ताह में 1 बार','નોંધ: અઠવાડિયે 1 વાર','note',0,0,0,0,0)
on conflict (id) do nothing;
