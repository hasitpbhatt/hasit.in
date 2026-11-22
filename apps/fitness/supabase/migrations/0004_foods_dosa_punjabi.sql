-- Batch 4: chilla/rotla/dosa/Punjabi/Gujarati coverage (TS 150 canonical)
insert into foods (id,en,hi,gu,unit,kcal,protein_g,carbs_g,fat_g,fiber_g) values
('jowar-rotla','Jowar rotla big (1)','ज्वार रोटला (1)','જુવારનો રોટલો (1)','pc',140,5,30,1.5,4),
('besan-chilla','Besan chilla (1)','बेसन चीला (1)','બેસન ચીલા (1)','pc',120,6,14,4,3),
('moong-chilla','Moong chilla (1)','मूंग चीला (1)','મગ ચીલા (1)','pc',110,8,13,3,3),
('masala-dosa','Masala dosa (1)','मसाला डोसा (1)','મસાલા ઢોસા (1)','pc',350,8,55,10,4),
('dal-dhokli','Dal dhokli (1 katori)','दाल ढोकली (1 कटोरी)','દાળ ઢોકળી (1 વાટકી)','katori',220,9,36,4,5),
('sarson-saag','Sarson saag (1 katori)','सरसों साग (1 कटोरी)','સરસવ સાગ (1 વાટકી)','katori',130,5,10,8,5),
('palak-paneer','Palak paneer (1 katori)','पालक पनीर (1 कटोरी)','પાલક પનીર (1 વાટકી)','katori',240,13,10,17,4),
('chana-masala','Chana masala (1 katori)','चना मसाला (1 कटोरी)','ચણા મસાલા (1 વાટકી)','katori',220,11,30,6,8),
('misal','Misal pav (1 plate)','मिसळ पाव (1 प्लेट)','મિસળ પાવ (1 પ્લેટ)','plate',400,14,55,12,8),
('shrikhand','Shrikhand (1 katori)','श्रीखंड (1 कटोरी)','શ્રીખંડ (1 વાટકી)','katori',230,6,32,9,0)
on conflict (id) do nothing;
