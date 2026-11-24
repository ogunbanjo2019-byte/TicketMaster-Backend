create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null default '',
  last_name text not null default '',
  email text not null default '',
  phone text not null default '',
  location text not null default 'Lagos, Nigeria',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.events (
  id text primary key,
  title text not null,
  short_title text not null,
  category text not null,
  tagline text not null default '',
  date_display text not null,
  date_iso date not null,
  venue text not null,
  city text not null,
  poster text not null default '',
  hero text not null default '',
  description text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.ticket_types (
  id text primary key,
  event_id text not null references public.events(id) on delete cascade,
  label text not null,
  price numeric(12,2) not null check (price >= 0),
  available integer not null default 0 check (available >= 0),
  unique (event_id, label)
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id text not null references public.events(id),
  ticket_type text not null references public.ticket_types(id),
  title text not null,
  date text not null,
  venue text not null,
  quantity integer not null check (quantity between 1 and 6),
  seats text[] not null,
  seat text not null,
  subtotal numeric(12,2) not null,
  service_fee numeric(12,2) not null,
  facility_fee numeric(12,2) not null,
  total numeric(12,2) not null,
  status text not null default 'Confirmed',
  code text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.seat_reservations (
  id bigint generated always as identity primary key,
  event_id text not null references public.events(id) on delete cascade,
  seat_code text not null,
  order_id uuid not null references public.orders(id) on delete cascade,
  unique (event_id, seat_code)
);

create table if not exists public.favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id text not null references public.events(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, event_id)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  icon text not null default '•',
  tone text not null default 'blue',
  title text not null,
  detail text not null default '',
  time text not null default 'Just now',
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.transfers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  recipient_first_name text not null,
  recipient_last_name text not null,
  recipient_contact text not null,
  message text not null default '',
  status text not null default 'Pending',
  created_at timestamptz not null default now()
);

create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  title text not null,
  asking_price numeric(12,2) not null check (asking_price > 0),
  quantity integer not null check (quantity between 1 and 6),
  status text not null default 'Active',
  created_at timestamptz not null default now()
);

create index if not exists orders_user_created_idx on public.orders(user_id, created_at desc);
create index if not exists seat_reservations_event_idx on public.seat_reservations(event_id);
create index if not exists notifications_user_created_idx on public.notifications(user_id, created_at desc);

insert into public.events (id,title,short_title,category,tagline,date_display,date_iso,venue,city,poster,hero,description) values
('music-festival','SoundWave Lagos 2026','SoundWave Lagos','Music','One city. One stage. All the sound.','Sat, Dec 12, 2026','2026-12-12','Eko Atlantic','Lagos','/assets/events/festival-crowd.jpg','/assets/events/singer-stage.jpg','A full day of live music, food, and unforgettable performances on the Lagos coast.'),
('comedy-night','Lagos Laughs Live','Lagos Laughs','Comedy','A night of big names and bigger laughs.','Fri, Dec 4, 2026','2026-12-04','Landmark Centre','Lagos','/assets/events/comedy-show.jpg','/assets/events/comedy-show.jpg','A live comedy showcase featuring headline acts and the next generation of Nigerian comics.'),
('afrobeats-live','Afrobeats Live','Afrobeats Live','Music','Your favorite artists, live and loud.','Sat, Jan 16, 2027','2027-01-16','Tafawa Balewa Square','Lagos','/assets/events/festival-crowd.jpg','/assets/events/singer-stage.jpg','A celebration of Afrobeats with live sets, guest appearances, and an energetic crowd.'),
('city-food-fest','Lagos Food & Culture Fest','Food & Culture Fest','Festival','Taste the city. Feel the culture.','Sun, Jan 24, 2027','2027-01-24','Muri Okunola Park','Lagos','/assets/events/festival-crowd.jpg','/assets/events/festival-crowd.jpg','Discover local food, makers, music, and culture in a family-friendly outdoor festival.')
on conflict (id) do update set title=excluded.title,short_title=excluded.short_title,category=excluded.category,tagline=excluded.tagline,date_display=excluded.date_display,date_iso=excluded.date_iso,venue=excluded.venue,city=excluded.city,poster=excluded.poster,hero=excluded.hero,description=excluded.description;

insert into public.ticket_types (id,event_id,label,price,available) values
('soundwave-general','music-festival','General Admission',85,500),('soundwave-vip','music-festival','VIP',180,100),('laughs-general','comedy-night','General Admission',45,300),('laughs-vip','comedy-night','VIP',95,80),('afrobeats-general','afrobeats-live','General Admission',70,450),('afrobeats-vip','afrobeats-live','VIP',150,90),('foodfest-general','city-food-fest','General Admission',25,800),('foodfest-vip','city-food-fest','VIP',65,120)
on conflict (id) do update set label=excluded.label,price=excluded.price,available=999999999;

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, first_name, last_name, email, phone)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'first_name',''), coalesce(new.raw_user_meta_data ->> 'last_name',''), coalesce(new.email,''), coalesce(new.raw_user_meta_data ->> 'phone',''))
  on conflict (id) do update set email=excluded.email;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert or update of email on auth.users for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.ticket_types enable row level security;
alter table public.orders enable row level security;
alter table public.seat_reservations enable row level security;
alter table public.favorites enable row level security;
alter table public.notifications enable row level security;
alter table public.transfers enable row level security;
alter table public.listings enable row level security;

drop policy if exists "Read own profile" on public.profiles;
create policy "Read own profile" on public.profiles for select to authenticated using ((select auth.uid()) = id);
drop policy if exists "Update own profile" on public.profiles;
create policy "Update own profile" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
drop policy if exists "Public read events" on public.events;
create policy "Public read events" on public.events for select to anon, authenticated using (true);
drop policy if exists "Public read ticket types" on public.ticket_types;
create policy "Public read ticket types" on public.ticket_types for select to anon, authenticated using (true);
drop policy if exists "Users read own orders" on public.orders;
create policy "Users read own orders" on public.orders for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Public read seat codes" on public.seat_reservations;
create policy "Public read seat codes" on public.seat_reservations for select to anon, authenticated using (true);
drop policy if exists "Users read own favorites" on public.favorites;
create policy "Users read own favorites" on public.favorites for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Users manage own favorites" on public.favorites;
create policy "Users manage own favorites" on public.favorites for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "Users read own notifications" on public.notifications;
create policy "Users read own notifications" on public.notifications for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Users update own notifications" on public.notifications;
create policy "Users update own notifications" on public.notifications for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "Users read own transfers" on public.transfers;
create policy "Users read own transfers" on public.transfers for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Users create own transfers" on public.transfers;
create policy "Users create own transfers" on public.transfers for insert to authenticated with check ((select auth.uid()) = user_id and exists (select 1 from public.orders o where o.id=order_id and o.user_id=(select auth.uid())));
drop policy if exists "Users read own listings" on public.listings;
create policy "Users read own listings" on public.listings for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Users create own listings" on public.listings;
create policy "Users create own listings" on public.listings for insert to authenticated with check ((select auth.uid()) = user_id and exists (select 1 from public.orders o where o.id=order_id and o.user_id=(select auth.uid())));

revoke all on public.profiles,public.events,public.ticket_types,public.orders,public.seat_reservations,public.favorites,public.notifications,public.transfers,public.listings from anon,authenticated;
grant select on public.events,public.ticket_types,public.seat_reservations to anon,authenticated;
grant select,update on public.profiles to authenticated;
grant select on public.orders,public.favorites,public.notifications,public.transfers,public.listings to authenticated;
grant insert,update,delete on public.favorites to authenticated;
grant update (read) on public.notifications to authenticated;
grant insert on public.transfers,public.listings to authenticated;
revoke update on public.profiles from authenticated;
grant update (first_name,last_name,phone,location,updated_at) on public.profiles to authenticated;

grant usage,select on all sequences in schema public to authenticated;

create or replace function public.create_ticket_order(p_event_id text,p_ticket_type text,p_quantity integer,p_seats text[])
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user_id uuid := auth.uid();
  v_event public.events%rowtype;
  v_ticket public.ticket_types%rowtype;
  v_order public.orders%rowtype;
  v_code text;
  v_seats text[];
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_quantity < 1 or p_quantity > 6 then raise exception 'Invalid ticket quantity'; end if;
  select * into v_event from public.events where id=p_event_id;
  if not found then raise exception 'Event not found'; end if;
  select * into v_ticket from public.ticket_types where id=p_ticket_type and event_id=p_event_id;
  if not found then raise exception 'Choose a valid event or ticket type'; end if;
  v_code := upper(substr(replace(gen_random_uuid()::text,'-',''),1,10));
  v_seats := array(select v_code || '-T' || lpad(n::text,2,'0') from generate_series(1,p_quantity) n);
  insert into public.orders(user_id,event_id,ticket_type,title,date,venue,quantity,seats,seat,subtotal,service_fee,facility_fee,total,status,code)
  values (v_user_id,p_event_id,p_ticket_type,v_event.short_title,v_event.date_display,v_event.venue,p_quantity,v_seats,v_ticket.label||' · '||p_quantity||' ticket(s)',v_ticket.price*p_quantity,round(v_ticket.price*p_quantity*0.12,0),round(v_ticket.price*p_quantity*0.067,0),v_ticket.price*p_quantity+round(v_ticket.price*p_quantity*0.12,0)+round(v_ticket.price*p_quantity*0.067,0),'Confirmed',v_code)
  returning * into v_order;
  insert into public.notifications(user_id,icon,tone,title,detail,time) values(v_user_id,'✓','green','Tickets confirmed',v_event.short_title||' · '||p_quantity||' ticket(s) added to wallet','Just now');
  return jsonb_build_object('id',v_order.id,'eventId',v_order.event_id,'title',v_order.title,'date',v_order.date,'venue',v_order.venue,'ticketType',v_ticket.label,'quantity',v_order.quantity,'seats',v_order.seats,'seat',v_order.seat,'subtotal',v_order.subtotal,'serviceFee',v_order.service_fee,'facilityFee',v_order.facility_fee,'total',v_order.total,'status',v_order.status,'code',v_order.code,'createdAt',v_order.created_at);
end;
$$;
revoke all on function public.create_ticket_order(text,text,integer,text[]) from public,anon;
grant execute on function public.create_ticket_order(text,text,integer,text[]) to authenticated;

-- Seat availability is public, but order IDs and reservation row IDs are not.
revoke select on public.seat_reservations from anon,authenticated;
grant select (event_id,seat_code) on public.seat_reservations to anon,authenticated;
