alter table public.fiscal_alerts
  add column if not exists tax_regime text,
  add column if not exists tax_model text;

alter table public.fiscal_alert_templates
  add column if not exists tax_regime text,
  add column if not exists tax_model text;

update public.fiscal_alerts
set
  tax_regime = coalesce(
    tax_regime,
    case
      when alert_type = 'cuota_cero' then 'cuota_cero_baleares'
      else 'general'
    end
  ),
  tax_model = coalesce(
    tax_model,
    case
      when alert_type = 'iva' then '303'
      when alert_type = 'irpf' then '130'
      when alert_type = 'retenciones' then '111'
      when alert_type = 'autonomo' then 'reta'
      when alert_type = 'cuota_cero' then 'cuota_cero'
      else 'custom'
    end
  );

update public.fiscal_alert_templates
set
  tax_regime = coalesce(
    tax_regime,
    case
      when alert_type = 'cuota_cero' then 'cuota_cero_baleares'
      else 'general'
    end
  ),
  tax_model = coalesce(
    tax_model,
    case
      when alert_type = 'iva' then '303'
      when alert_type = 'irpf' then '130'
      when alert_type = 'retenciones' then '111'
      when alert_type = 'autonomo' then 'reta'
      when alert_type = 'cuota_cero' then 'cuota_cero'
      else 'custom'
    end
  );
