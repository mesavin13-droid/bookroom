-- BOOKROOM demo data. Runs on `supabase db reset`. Dates are relative to now(),
-- so the demo always has past history and free future slots.
--
-- Demo accounts (local only):
--   owner@bookroom.dev  / bookroom-demo   -> owner of Graphite and Barber Room
--   client@bookroom.dev / bookroom-demo   -> client with booking history
--   admin@bookroom.dev  / bookroom-demo   -> platform admin (/platform)
--   me.savin13@gmail.com                  -> becomes platform admin on first sign-in

-- Platform admins are granted automatically when these emails sign up.
insert into public.platform_admin_emails (email) values ('admin@bookroom.dev'), ('me.savin13@gmail.com');

-- ---------------------------------------------------------------------------
-- Auth users
-- ---------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
   'owner@bookroom.dev', extensions.crypt('bookroom-demo', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Алина Воронцова"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
   'client@bookroom.dev', extensions.crypt('bookroom-demo', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Дмитрий Савин"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-4000-8000-000000000009', 'authenticated', 'authenticated',
   'admin@bookroom.dev', extensions.crypt('bookroom-demo', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Администратор платформы"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-4000-8000-000000000008', 'authenticated', 'authenticated',
   'owner2@bookroom.dev', extensions.crypt('bookroom-demo', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Игорь Кравцов"}', now(), now(), '', '', '', '');

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
   '{"sub":"a0000000-0000-4000-8000-000000000001","email":"owner@bookroom.dev","email_verified":true}', 'email', now(), now(), now()),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000002',
   '{"sub":"a0000000-0000-4000-8000-000000000002","email":"client@bookroom.dev","email_verified":true}', 'email', now(), now(), now()),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000009', 'a0000000-0000-4000-8000-000000000009',
   '{"sub":"a0000000-0000-4000-8000-000000000009","email":"admin@bookroom.dev","email_verified":true}', 'email', now(), now(), now()),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000008', 'a0000000-0000-4000-8000-000000000008',
   '{"sub":"a0000000-0000-4000-8000-000000000008","email":"owner2@bookroom.dev","email_verified":true}', 'email', now(), now(), now());

-- ---------------------------------------------------------------------------
-- Graphite Studio
-- ---------------------------------------------------------------------------
insert into public.studios (id, slug, name, kind, tagline, description, address, city, latitude, longitude,
  phone, email, website, telegram, vk, instagram, logo_url, cover_url, timezone)
values (
  'b0000000-0000-4000-8000-000000000001', 'graphite', 'Graphite', 'Studio / Beauty Space',
  'Пространство для ухода и хорошего настроения.',
  'Небольшая студия в центре города: три мастера, спокойная музыка и время, которое принадлежит только вам. Мы работаем по записи, поэтому в зале никогда не бывает очереди. Используем профессиональную косметику и одноразовые расходники.',
  'Москва, ул. Покровка, 17, стр. 2', 'Москва', 55.759240, 37.646610,
  '+74951234567', 'hello@graphite.studio', 'https://graphite.studio', 'graphite_studio', 'graphite_studio', 'graphite.studio',
  null,
  'https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&w=2000&q=80',
  'Europe/Moscow'
);

update public.studio_settings
   set min_notice_minutes = 120, max_advance_days = 30, cancel_notice_minutes = 180,
       allow_reschedule = true, auto_confirm = true, slot_step_minutes = 30
 where studio_id = 'b0000000-0000-4000-8000-000000000001';

insert into public.profiles (id, full_name, email) values
  ('a0000000-0000-4000-8000-000000000001', 'Алина Воронцова', 'owner@bookroom.dev'),
  ('a0000000-0000-4000-8000-000000000002', 'Дмитрий Савин', 'client@bookroom.dev')
on conflict (id) do update set full_name = excluded.full_name;

insert into public.studio_members (studio_id, profile_id, role)
values ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'owner');

insert into public.service_categories (id, studio_id, name, sort_order) values
  ('c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'Стрижка', 1),
  ('c0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', 'Борода', 2),
  ('c0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000001', 'Комплекс', 3),
  ('c0000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000001', 'Окрашивание', 4),
  ('c0000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000001', 'Уход', 5),
  ('c0000000-0000-4000-8000-000000000006', 'b0000000-0000-4000-8000-000000000001', 'Другое', 6);

insert into public.services (id, studio_id, category_id, name, description, price, duration_minutes, sort_order) values
  ('d0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001',
   'Стрижка', 'Консультация, мытьё головы, стрижка машинкой и ножницами, укладка.', 1500, 60, 1),
  ('d0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000003',
   'Barber Combo', 'Стрижка и оформление бороды в один визит. Горячее полотенце в подарок.', 2500, 90, 2),
  ('d0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002',
   'Оформление бороды', 'Моделирование формы, контур опасной бритвой, уход маслом.', 1000, 40, 3),
  ('d0000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000004',
   'Камуфляж седины', 'Тонирование волос или бороды, выглядит естественно и держится до 6 недель.', 1800, 45, 4),
  ('d0000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000005',
   'Уход для кожи головы', 'Пилинг, массаж и маска. Хорошо сочетается со стрижкой.', 1200, 30, 5);

insert into public.staff (id, studio_id, name, position, bio, photo_url, sort_order) values
  ('e0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'Иван Соколов', 'Senior barber',
   '9 лет в профессии. Классические мужские стрижки, фейды и аккуратная борода.',
   'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=800&q=80', 1),
  ('e0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', 'Анна Лебедева', 'Стилист-колорист',
   'Работает с длинными волосами и сложным цветом. Подберёт форму под ваш ритм жизни.',
   'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=800&q=80', 2),
  ('e0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000001', 'Марк Орлов', 'Барбер',
   'Текстурные стрижки, кроп и уход. Любит спокойные разговоры о музыке.',
   'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=800&q=80', 3);

insert into public.staff_services (staff_id, service_id, studio_id)
select x.staff_id::uuid, x.service_id::uuid, 'b0000000-0000-4000-8000-000000000001'::uuid
from (values
  ('e0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001'),
  ('e0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000002'),
  ('e0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000003'),
  ('e0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000001'),
  ('e0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000004'),
  ('e0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000005'),
  ('e0000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000001'),
  ('e0000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000002'),
  ('e0000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000003'),
  ('e0000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000005')
) as x(staff_id, service_id);

-- Иван: Пн–Пт 10–20, перерыв 14–15. Анна: Вт–Сб 10–19, перерыв 14:00–14:30. Марк: Ср–Вс 11–21, перерыв 15–16.
insert into public.staff_schedules (studio_id, staff_id, weekday, is_working, start_time, end_time)
select 'b0000000-0000-4000-8000-000000000001', s.staff_id::uuid, d.wd,
       d.wd = any (s.days), s.start_t::time, s.end_t::time
from (values
  ('e0000000-0000-4000-8000-000000000001', array[1,2,3,4,5], '10:00', '20:00'),
  ('e0000000-0000-4000-8000-000000000002', array[2,3,4,5,6], '10:00', '19:00'),
  ('e0000000-0000-4000-8000-000000000003', array[3,4,5,6,7], '11:00', '21:00')
) as s(staff_id, days, start_t, end_t)
cross join generate_series(1, 7) as d(wd);

insert into public.schedule_breaks (studio_id, staff_id, weekday, start_time, end_time)
select 'b0000000-0000-4000-8000-000000000001', s.staff_id::uuid, d.wd, s.b_start::time, s.b_end::time
from (values
  ('e0000000-0000-4000-8000-000000000001', array[1,2,3,4,5], '14:00', '15:00'),
  ('e0000000-0000-4000-8000-000000000002', array[2,3,4,5,6], '14:00', '14:30'),
  ('e0000000-0000-4000-8000-000000000003', array[3,4,5,6,7], '15:00', '16:00')
) as s(staff_id, days, b_start, b_end)
cross join generate_series(1, 7) as d(wd)
where d.wd = any (s.days);

insert into public.days_off (studio_id, staff_id, start_date, end_date, kind, reason)
values ('b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000002',
        (now() at time zone 'Europe/Moscow')::date + 16, (now() at time zone 'Europe/Moscow')::date + 21, 'vacation', 'Отпуск');

insert into public.media (studio_id, kind, url, alt, sort_order) values
  ('b0000000-0000-4000-8000-000000000001', 'gallery', 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=1400&q=80', 'Рабочее место барбера', 1),
  ('b0000000-0000-4000-8000-000000000001', 'gallery', 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&w=1400&q=80', 'Стрижка в процессе', 2),
  ('b0000000-0000-4000-8000-000000000001', 'gallery', 'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=1400&q=80', 'Интерьер студии', 3),
  ('b0000000-0000-4000-8000-000000000001', 'gallery', 'https://images.unsplash.com/photo-1599351431202-1e0f0137899a?auto=format&fit=crop&w=1400&q=80', 'Инструменты', 4);

-- 20 clients. One is linked to the demo client account.
insert into public.clients (studio_id, name, phone, email, status, created_at, profile_id)
select 'b0000000-0000-4000-8000-000000000001', x.name, x.phone, x.email, x.status::public.client_status,
       now() - make_interval(days => x.age_days), x.profile_id::uuid
from (values
  ('Дмитрий Савин',      '+79161230001', 'client@bookroom.dev', 'vip',    80, 'a0000000-0000-4000-8000-000000000002'),
  ('Алексей Ковалёв',    '+79161230002', null, 'active', 75, null),
  ('Мария Белова',       '+79161230003', 'm.belova@example.com', 'active', 70, null),
  ('Сергей Миронов',     '+79161230004', null, 'active', 66, null),
  ('Екатерина Зайцева',  '+79161230005', 'kate.z@example.com', 'vip', 62, null),
  ('Павел Никитин',      '+79161230006', null, 'active', 58, null),
  ('Ольга Григорьева',   '+79161230007', null, 'active', 54, null),
  ('Никита Фролов',      '+79161230008', 'nfrolov@example.com', 'active', 50, null),
  ('Анастасия Попова',   '+79161230009', null, 'active', 46, null),
  ('Артём Васильев',     '+79161230010', null, 'active', 42, null),
  ('Юлия Морозова',      '+79161230011', 'yulia.m@example.com', 'active', 38, null),
  ('Максим Волков',      '+79161230012', null, 'active', 34, null),
  ('Виктория Соловьёва', '+79161230013', null, 'active', 30, null),
  ('Илья Егоров',        '+79161230014', null, 'active', 26, null),
  ('Дарья Кузнецова',    '+79161230015', 'dasha.k@example.com', 'active', 22, null),
  ('Роман Лебедев',      '+79161230016', null, 'active', 18, null),
  ('Полина Андреева',    '+79161230017', null, 'active', 14, null),
  ('Кирилл Тарасов',     '+79161230018', null, 'blocked', 10, null),
  ('Светлана Орлова',    '+79161230019', null, 'active', 5, null),
  ('Глеб Семенов',       '+79161230020', null, 'active', 0, null)
) as x(name, phone, email, status, age_days, profile_id);

-- Appointments: 35 days of history and 12 days ahead. Notifications are not
-- generated for seed rows.
alter table public.appointments disable trigger appointments_notify;

do $$
declare
  v_studio uuid := 'b0000000-0000-4000-8000-000000000001';
  v_tz text := 'Europe/Moscow';
  v_today date := (now() at time zone 'Europe/Moscow')::date;
  v_clients uuid[];
  v_date date;
  v_dow integer;
  r record;
  t text;
  v_seed integer;
  v_service record;
  v_start timestamptz;
  v_end timestamptz;
  v_status public.appointment_status;
  v_count integer;
begin
  select array_agg(id order by created_at) into v_clients
  from public.clients where studio_id = v_studio and status <> 'blocked';

  for d in -35..12 loop
    v_date := v_today + d;
    v_dow := extract(isodow from v_date)::integer;
    for r in
      select x.staff_id::uuid as staff_id, x.slots
      from (values
        ('e0000000-0000-4000-8000-000000000001', array['10:00', '11:30', '16:00', '18:00']),
        ('e0000000-0000-4000-8000-000000000002', array['10:00', '12:00', '15:00', '17:00']),
        ('e0000000-0000-4000-8000-000000000003', array['11:00', '13:00', '16:30', '19:00'])
      ) as x(staff_id, slots)
    loop
      continue when not exists (
        select 1 from public.staff_schedules s where s.staff_id = r.staff_id and s.weekday = v_dow and s.is_working);
      continue when exists (
        select 1 from public.days_off o where o.staff_id = r.staff_id and v_date between o.start_date and o.end_date);

      select count(*) into v_count from public.staff_services where staff_id = r.staff_id;

      foreach t in array r.slots loop
        v_seed := abs(hashtext(r.staff_id::text || v_date::text || t)) % 100;
        continue when d >= 0 and v_seed < 50;   -- leave many future slots free
        continue when d < 0 and v_seed < 18;

        select sv.id, sv.price, sv.duration_minutes into v_service
        from public.staff_services ss join public.services sv on sv.id = ss.service_id
        where ss.staff_id = r.staff_id
        order by sv.sort_order
        offset (v_seed % v_count) limit 1;

        v_start := (v_date + t::time) at time zone v_tz;
        v_end := v_start + make_interval(mins => v_service.duration_minutes);
        v_status := case
          when v_end < now() then
            case when v_seed % 17 = 0 then 'no_show' when v_seed % 13 = 0 then 'cancelled' else 'completed' end
          else
            case when v_seed % 7 = 0 then 'pending' else 'confirmed' end
        end::public.appointment_status;

        insert into public.appointments (studio_id, client_id, staff_id, service_id, start_at, end_at, price, status, source,
                                         cancelled_at, created_at)
        values (v_studio, v_clients[1 + abs(hashtext(t || v_date::text || r.staff_id::text)) % array_length(v_clients, 1)],
                r.staff_id, v_service.id, v_start, v_end, v_service.price, v_status,
                case when v_seed % 5 = 0 then 'admin' else 'online' end::public.appointment_source,
                case when v_status = 'cancelled' then v_start - interval '1 day' end,
                least(v_start - interval '2 days', now()));
      end loop;
    end loop;
  end loop;
end $$;

alter table public.appointments enable trigger appointments_notify;

-- Make sure the demo client has one upcoming and some past visits.
update public.appointments a set client_id = (select id from public.clients where phone = '+79161230001')
where a.id in (
  select id from public.appointments
  where studio_id = 'b0000000-0000-4000-8000-000000000001' and status = 'completed'
  order by start_at desc limit 3
) or a.id = (
  select id from public.appointments
  where studio_id = 'b0000000-0000-4000-8000-000000000001' and status = 'confirmed' and start_at > now() + interval '1 day'
  order by start_at limit 1
);

-- Reviews on completed visits
insert into public.reviews (studio_id, appointment_id, client_id, staff_id, rating, comment, author_name, status, created_at)
select a.studio_id, a.id, a.client_id, a.staff_id, x.rating, x.comment,
       split_part(c.name, ' ', 1) || ' ' || left(split_part(c.name, ' ', 2), 1) || '.',
       x.status::public.review_status, a.end_at + interval '5 hours'
from (
  select a.*, row_number() over (order by a.start_at desc) as rn
  from public.appointments a
  where a.studio_id = 'b0000000-0000-4000-8000-000000000001' and a.status = 'completed'
) a
join public.clients c on c.id = a.client_id
join (values
  (4,  5, 'Лучшая стрижка за последние годы. Иван слушает и делает ровно то, что просишь.', 'published'),
  (7,  5, 'Очень спокойная атмосфера, никто не торопит. Записалась онлайн за минуту.', 'published'),
  (10, 4, 'Хороший результат, немного задержались с началом, но предупредили заранее.', 'published'),
  (13, 5, 'Анна подобрала тон идеально, седины не видно вообще. Вернусь.', 'published'),
  (16, 5, 'Barber Combo того стоит. Горячее полотенце отдельное удовольствие.', 'published'),
  (19, 5, 'Удобно, что можно выбрать конкретного мастера и время без звонков.', 'published'),
  (22, 3, 'Нормально, но ожидал чуть короче по бокам.', 'pending')
) as x(rn, rating, comment, status) on x.rn = a.rn;

-- A few in-app notifications for the admin inbox
insert into public.notifications (studio_id, audience, type, appointment_id, title, body, created_at)
select a.studio_id, 'studio', 'booking_created', a.id, 'Новая запись',
       sv.name || ' · ' || sf.name || ' · ' || to_char(a.start_at at time zone 'Europe/Moscow', 'DD.MM.YYYY, HH24:MI'),
       now() - make_interval(hours => (row_number() over (order by a.start_at))::int * 3)
from public.appointments a
join public.services sv on sv.id = a.service_id
join public.staff sf on sf.id = a.staff_id
where a.studio_id = 'b0000000-0000-4000-8000-000000000001' and a.start_at > now() and a.status in ('pending', 'confirmed')
order by a.start_at
limit 4;

-- ---------------------------------------------------------------------------
-- Second studio (shows multi-studio routing and the studio switcher)
-- ---------------------------------------------------------------------------
insert into public.studios (id, slug, name, kind, tagline, description, address, city, phone, telegram, cover_url, timezone)
values ('b0000000-0000-4000-8000-000000000002', 'barber-room', 'Barber Room', 'Barbershop',
        'Мужские стрижки без лишних слов.', 'Барбершоп у метро. Быстро, аккуратно, по записи.',
        'Москва, Новослободская ул., 4', 'Москва', '+74959876543', 'barber_room',
        'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=2000&q=80', 'Europe/Moscow');

insert into public.studio_members (studio_id, profile_id, role)
values ('b0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'owner');

insert into public.service_categories (id, studio_id, name, sort_order) values
  ('c0000000-0000-4000-8000-000000000101', 'b0000000-0000-4000-8000-000000000002', 'Стрижка', 1),
  ('c0000000-0000-4000-8000-000000000102', 'b0000000-0000-4000-8000-000000000002', 'Борода', 2);

insert into public.services (id, studio_id, category_id, name, description, price, duration_minutes, sort_order) values
  ('d0000000-0000-4000-8000-000000000101', 'b0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000101', 'Мужская стрижка', 'Машинка и ножницы, укладка.', 1300, 45, 1),
  ('d0000000-0000-4000-8000-000000000102', 'b0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000101', 'Стрижка машинкой', 'Одна насадка, быстро.', 800, 30, 2),
  ('d0000000-0000-4000-8000-000000000103', 'b0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000102', 'Борода', 'Форма и контур.', 900, 30, 3);

insert into public.staff (id, studio_id, name, position, photo_url, sort_order) values
  ('e0000000-0000-4000-8000-000000000101', 'b0000000-0000-4000-8000-000000000002', 'Тимур Ахметов', 'Барбер',
   'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80', 1);

insert into public.staff_services (staff_id, service_id, studio_id)
select 'e0000000-0000-4000-8000-000000000101', id, 'b0000000-0000-4000-8000-000000000002'
from public.services where studio_id = 'b0000000-0000-4000-8000-000000000002';

insert into public.staff_schedules (studio_id, staff_id, weekday, is_working, start_time, end_time)
select 'b0000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000101', wd, wd <= 6, '10:00', '20:00'
from generate_series(1, 7) as wd;

-- ---------------------------------------------------------------------------
-- NORD Detailing: demo for car detailing / auto service (vertical = auto)
-- ---------------------------------------------------------------------------
insert into public.studios (id, slug, name, kind, tagline, description, address, city, latitude, longitude, phone, telegram,
  cover_url, timezone, vertical)
values ('b0000000-0000-4000-8000-000000000003', 'nord', 'NORD Detailing', 'Detailing / Car Care',
  'Детейлинг, который возвращает кузову глубину, а салону чистоту',
  'Три бокса, профессиональная химия и аккуратная работа с каждым автомобилем. Принимаем по записи, авто можно оставить на несколько дней.',
  'Москва, Складочная ул., 1', 'Москва', 55.800500, 37.597800, '+74951112233', 'nord_detailing',
  'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=2000&q=80', 'Europe/Moscow', 'auto');

update public.studio_settings
   set min_notice_minutes = 60, max_advance_days = 45, cancel_notice_minutes = 720, slot_step_minutes = 60, auto_confirm = true
 where studio_id = 'b0000000-0000-4000-8000-000000000003';

insert into public.studio_members (studio_id, profile_id, role)
values ('b0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 'owner');

insert into public.service_categories (id, studio_id, name, sort_order) values
  ('c0000000-0000-4000-8000-000000000301', 'b0000000-0000-4000-8000-000000000003', 'Мойка', 1),
  ('c0000000-0000-4000-8000-000000000302', 'b0000000-0000-4000-8000-000000000003', 'Салон', 2),
  ('c0000000-0000-4000-8000-000000000303', 'b0000000-0000-4000-8000-000000000003', 'Кузов', 3),
  ('c0000000-0000-4000-8000-000000000304', 'b0000000-0000-4000-8000-000000000003', 'Шины', 4);

insert into public.services (id, studio_id, category_id, name, description, price, price_from, duration_minutes, duration_days, sort_order) values
  ('d0000000-0000-4000-8000-000000000301', 'b0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000301',
   'Комплексная мойка', 'Кузов, диски, стёкла и аккуратная уборка салона за один заезд', 3500, false, 120, null, 1),
  ('d0000000-0000-4000-8000-000000000302', 'b0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000302',
   'Химчистка салона', 'Глубокая очистка ткани, кожи и поверхностей, чтобы вернуть салону свежесть', 12000, true, 480, 1, 2),
  ('d0000000-0000-4000-8000-000000000303', 'b0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000303',
   'Полировка кузова', 'Убираем мелкие царапины и возвращаем кузову глубокий блеск', 18000, true, 480, 1, 3),
  ('d0000000-0000-4000-8000-000000000304', 'b0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000303',
   'Керамическое покрытие', 'Подготовка, полировка и два слоя керамики. Защита ЛКП до 2 лет', 25000, true, 480, 2, 4),
  ('d0000000-0000-4000-8000-000000000305', 'b0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000304',
   'Шиномонтаж R13–R18', 'Снятие, балансировка и установка четырёх колёс', 2400, true, 60, null, 5);

insert into public.staff (id, studio_id, name, position, bio, sort_order) values
  ('e0000000-0000-4000-8000-000000000301', 'b0000000-0000-4000-8000-000000000003', 'Бокс 1', 'Мойка и химчистка', 'Тёплый бокс с вытяжкой', 1),
  ('e0000000-0000-4000-8000-000000000302', 'b0000000-0000-4000-8000-000000000003', 'Бокс 2', 'Полировка и керамика', 'Освещение для контроля ЛКП', 2),
  ('e0000000-0000-4000-8000-000000000303', 'b0000000-0000-4000-8000-000000000003', 'Бокс 3', 'Шиномонтаж и мойка', 'Подъёмник и балансировочный стенд', 3);

insert into public.staff_services (staff_id, service_id, studio_id)
select x.s::uuid, x.v::uuid, 'b0000000-0000-4000-8000-000000000003'::uuid from (values
  ('e0000000-0000-4000-8000-000000000301', 'd0000000-0000-4000-8000-000000000301'),
  ('e0000000-0000-4000-8000-000000000301', 'd0000000-0000-4000-8000-000000000302'),
  ('e0000000-0000-4000-8000-000000000302', 'd0000000-0000-4000-8000-000000000303'),
  ('e0000000-0000-4000-8000-000000000302', 'd0000000-0000-4000-8000-000000000304'),
  ('e0000000-0000-4000-8000-000000000303', 'd0000000-0000-4000-8000-000000000305'),
  ('e0000000-0000-4000-8000-000000000303', 'd0000000-0000-4000-8000-000000000301')
) as x(s, v);

-- Mon–Sat 09:00–19:00, Sunday off
insert into public.staff_schedules (studio_id, staff_id, weekday, is_working, start_time, end_time)
select 'b0000000-0000-4000-8000-000000000003', s.id, wd, wd <= 6, '09:00', '19:00'
from public.staff s cross join generate_series(1, 7) as wd
where s.studio_id = 'b0000000-0000-4000-8000-000000000003';

insert into public.media (studio_id, kind, url, alt, sort_order) values
  ('b0000000-0000-4000-8000-000000000003', 'gallery', 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1400&q=80', 'Детали кузова', 1),
  ('b0000000-0000-4000-8000-000000000003', 'gallery', 'https://images.unsplash.com/photo-1580273916550-e323be2ae537?auto=format&fit=crop&w=1400&q=80', 'Капот и оптика после полировки', 2),
  ('b0000000-0000-4000-8000-000000000003', 'gallery', 'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?auto=format&fit=crop&w=1400&q=80', 'Керамика, второй слой', 3);

insert into public.clients (studio_id, name, phone, vehicle_model, vehicle_plate, created_at) values
  ('b0000000-0000-4000-8000-000000000003', 'Олег Петров', '+79161230101', 'BMW X5', 'А001АА 777', now() - interval '40 days'),
  ('b0000000-0000-4000-8000-000000000003', 'Ирина Смирнова', '+79161230102', 'Kia Rio', 'В222ВВ 199', now() - interval '30 days'),
  ('b0000000-0000-4000-8000-000000000003', 'Тимур Галиев', '+79161230103', 'Toyota Camry', 'Е333КХ 750', now() - interval '20 days'),
  ('b0000000-0000-4000-8000-000000000003', 'Денис Ким', '+79161230104', 'Porsche Macan', 'М444ММ 77', now() - interval '10 days');

alter table public.appointments disable trigger appointments_notify;

-- Seed bookings, including a 2-day ceramic job (skips Sunday).
do $$
declare
  v_tz text := 'Europe/Moscow';
  v_today date := (now() at time zone 'Europe/Moscow')::date;
  v_studio uuid := 'b0000000-0000-4000-8000-000000000003';
  d date;
  r record;
  i int := 0;
begin
  for r in
    select * from (values
      (-14, '10:00', 2, 'd0000000-0000-4000-8000-000000000301', 'e0000000-0000-4000-8000-000000000301', '+79161230101', 'completed'),
      (-12, '09:00', 0, 'd0000000-0000-4000-8000-000000000303', 'e0000000-0000-4000-8000-000000000302', '+79161230102', 'completed'),
      (-9,  '09:00', 0, 'd0000000-0000-4000-8000-000000000302', 'e0000000-0000-4000-8000-000000000301', '+79161230103', 'completed'),
      (-6,  '14:00', 1, 'd0000000-0000-4000-8000-000000000305', 'e0000000-0000-4000-8000-000000000303', '+79161230104', 'completed'),
      (2,   '12:00', 2, 'd0000000-0000-4000-8000-000000000301', 'e0000000-0000-4000-8000-000000000303', '+79161230102', 'confirmed'),
      (3,   '09:00', 0, 'd0000000-0000-4000-8000-000000000304', 'e0000000-0000-4000-8000-000000000302', '+79161230104', 'confirmed'),
      (4,   '09:00', 0, 'd0000000-0000-4000-8000-000000000302', 'e0000000-0000-4000-8000-000000000301', '+79161230101', 'pending')
    ) as x(off, t, hours, svc, box, phone, status)
  loop
    d := v_today + r.off;
    while extract(isodow from d) = 7 loop d := d + 1; end loop;  -- skip Sunday
    insert into public.appointments (studio_id, client_id, staff_id, service_id, start_at, end_at, price, status, source,
                                     vehicle_model, vehicle_plate)
    select v_studio, c.id, r.box::uuid, sv.id,
           (d + r.t::time) at time zone v_tz,
           case
             when sv.duration_days is null then ((d + r.t::time) at time zone v_tz) + make_interval(mins => sv.duration_minutes)
             else ((d + (sv.duration_days - 1) + case when extract(isodow from d) + sv.duration_days - 1 >= 7 then 1 else 0 end) + time '19:00') at time zone v_tz
           end,
           sv.price, r.status::public.appointment_status, 'online', c.vehicle_model, c.vehicle_plate
    from public.services sv, public.clients c
    where sv.id = r.svc::uuid and c.studio_id = v_studio and c.phone = r.phone;
  end loop;
end $$;

alter table public.appointments enable trigger appointments_notify;

insert into public.reviews (studio_id, appointment_id, client_id, staff_id, rating, comment, author_name, status, created_at)
select a.studio_id, a.id, a.client_id, a.staff_id, 5,
       case row_number() over (order by a.start_at)
         when 1 then 'Машина после мойки как из салона, внутри идеально.'
         when 2 then 'Полировка убрала все паутинки, очень доволен.'
         else 'Быстро, аккуратно, отдали в обещанное время.' end,
       split_part(c.name, ' ', 1) || ' ' || left(split_part(c.name, ' ', 2), 1) || '.', 'published', a.end_at + interval '3 hours'
from public.appointments a join public.clients c on c.id = a.client_id
where a.studio_id = 'b0000000-0000-4000-8000-000000000003' and a.status = 'completed';


-- ---------------------------------------------------------------------------
-- Platform demo: a draft and a suspended studio of another owner
-- ---------------------------------------------------------------------------
insert into public.studios (id, slug, name, kind, city, address, phone, timezone, vertical, is_published, created_by, created_at)
values
  ('b0000000-0000-4000-8000-000000000008', 'shina-24', 'Шина 24', 'Шиномонтаж', 'Красноярск', 'ул. Партизана Железняка, 40', '+73912000024',
   'Asia/Krasnoyarsk', 'auto', false, 'a0000000-0000-4000-8000-000000000008', now() - interval '2 days'),
  ('b0000000-0000-4000-8000-000000000009', 'moyka-express', 'Мойка Экспресс', 'Автомойка', 'Красноярск', 'пр. Мира, 3', '+73912000003',
   'Asia/Krasnoyarsk', 'auto', false, 'a0000000-0000-4000-8000-000000000008', now() - interval '20 days');
update public.studios set suspended_at = now() - interval '1 day', suspend_reason = 'Жалобы клиентов: не подтверждает записи'
 where id = 'b0000000-0000-4000-8000-000000000009';
insert into public.studio_members (studio_id, profile_id, role) values
  ('b0000000-0000-4000-8000-000000000008', 'a0000000-0000-4000-8000-000000000008', 'owner'),
  ('b0000000-0000-4000-8000-000000000009', 'a0000000-0000-4000-8000-000000000008', 'owner');
insert into public.platform_audit (actor_id, studio_id, action, reason, created_at) values
  ('a0000000-0000-4000-8000-000000000009', 'b0000000-0000-4000-8000-000000000009', 'suspend', 'Жалобы клиентов: не подтверждает записи', now() - interval '1 day');
