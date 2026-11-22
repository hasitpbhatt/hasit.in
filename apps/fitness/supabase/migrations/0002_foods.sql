-- 200-item goal: starter 15 trilingual staples (expand weekly)
create table if not exists foods (id text primary key, en text not null, hi text not null, gu text not null, unit text not null, kcal int not null, protein_g numeric not null, carbs_g numeric, fat_g numeric, fiber_g numeric);
insert into foods (id,en,hi,gu,unit,kcal,protein_g,carbs_g,fat_g,fiber_g) values
('roti','Roti (1)','रोटी (1)','રોટલી (1)','pc',80,3,15,1,2),
('dal','Dal (1 katori)','दाल (1 कटोरी)','દાળ (1 વાટકી)','katori',150,9,20,4,5),
('sabzi','Sabzi (1 katori)','सब्ज़ी (1 कटोरी)','શાક (1 વાટકી)','katori',100,3,12,5,4),
('curd','Curd (1 katori)','दही (1 कटोरी)','દહીં (1 વાટકી)','katori',100,5,7,5,0),
('paneer','Paneer (100g)','पनीर (100g)','પનીર (100g)','100g',265,18,4,20,0),
('soya','Soya chunks dry (50g)','सोया चंक्स (50g)','સોયા ચંક્સ (50g)','50g',170,26,16,0.5,7)
on conflict (id) do nothing;
