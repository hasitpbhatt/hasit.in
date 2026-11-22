-- Expand staples batch 2 (TS lib/foods.ts is canonical with 70 items; DB catches up weekly)
insert into foods (id,en,hi,gu,unit,kcal,protein_g,carbs_g,fat_g,fiber_g) values
('poha','Poha (1 katori)','पोहा (1 कटोरी)','પૌંઆ (1 વાટકી)','katori',140,3,28,2,2),
('upma','Upma (1 katori)','उपमा (1 कटोरी)','ઉપમા (1 વાટકી)','katori',160,4,30,3,2),
('idli','Idli (2 pc)','इडली (2)','ઈડલી (2)','2pc',120,4,26,0.5,1),
('khichdi','Khichdi (1 katori)','खिचड़ी (1 कटोरी)','ખીચડી (1 વાટકી)','katori',170,7,28,3,4),
('chole','Chole (1 katori)','छोले (1 कटोरी)','ચોલે (1 વાટકી)','katori',210,11,32,4,8),
('sprouts','Moong sprouts (1 katori)','अंकुरित मूंग (1 कटोरी)','ફણગાવેલા મગ (1 વાટકી)','katori',100,8,18,0.5,5),
('dhokla','Dhokla (2 pc)','ढोकला (2)','ઢોકળા (2)','2pc',120,5,22,2,2),
('kadhi','Kadhi (1 katori)','कढ़ी (1 कटोरी)','કઢી (1 વાટકી)','katori',120,5,12,6,1),
('buttermilk','Chaas (1 glass)','छाछ (1 गिलास)','છાશ (1 ગ્લાસ)','glass',40,3,5,1,0),
('oats','Oats (40g dry)','ओट्स (40g)','ઓટ્સ (40g)','40g',150,5,27,3,4)
on conflict (id) do nothing;
