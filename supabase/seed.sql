insert into public.teams (name, color_hex) values
('Team Mosleys', '#F39C12'),
('Team Benefactor', '#BDC3C7'),
('Team Cigar Lounge', '#9B59B6')
on conflict (name) do nothing;

insert into public.drivers (number, name, team_id)
select 11, 'A. Reyes', t.id from public.teams t where t.name='Team Mosleys';
insert into public.drivers (number, name, team_id)
select 22, 'K. Silva', t.id from public.teams t where t.name='Team Benefactor';
insert into public.drivers (number, name, team_id)
select 33, 'L. Tanaka', t.id from public.teams t where t.name='Team Cigar Lounge';
