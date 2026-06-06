-- A per_set catalog item represents one complete nail set. The app normalizes model/browser input
-- to quantity=1 before pricing and snapshot persistence. This trigger is the final database guard:
-- direct service-role writes with a larger quantity are rejected instead of silently creating an
-- item/preview mismatch.

create or replace function public.enforce_merchant_style_item_quantity()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_pricing_unit text;
begin
  select coalesce(mp.pricing_unit, ci.default_pricing_unit) into v_pricing_unit
  from public.catalog_item ci
  join public.merchant_style ms on ms.id = new.merchant_style_id
  left join public.merchant_pricing mp
    on mp.merchant_id = ms.merchant_id and mp.catalog_item_id = ci.id
  where ci.id = new.catalog_item_id;

  if v_pricing_unit = 'per_set' and new.quantity <> 1 then
    raise exception 'merchant_style_per_set_quantity_must_be_one';
  end if;

  return new;
end;
$$;

drop trigger if exists merchant_style_item_quantity_guard on public.merchant_style_item;
create trigger merchant_style_item_quantity_guard
before insert or update of catalog_item_id, quantity on public.merchant_style_item
for each row execute function public.enforce_merchant_style_item_quantity();

revoke all on function public.enforce_merchant_style_item_quantity() from public, anon, authenticated;
grant execute on function public.enforce_merchant_style_item_quantity() to service_role;
