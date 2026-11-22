-- Goals support (additive)
alter table profiles add column if not exists goal text default 'lose' check (goal in ('lose','gain','maintain','muscle','growth'));
