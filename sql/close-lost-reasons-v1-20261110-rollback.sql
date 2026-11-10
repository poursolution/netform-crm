-- 되돌리기: close-lost-reasons-v1-20261110.sql (실주 원인 새 목록 받기) — 예전 13개만 받던 상태로
begin;
do $rb$
declare o oid; d text; i int; j int; endtag text := '/* close-lost-reasons-v1:end */';
begin
 select p.oid into o from pg_proc p join pg_namespace s on s.oid=p.pronamespace
  where s.nspname in ('public','crm_security') and p.proname='crm_deal_close_nonwon_command_v1' and p.prokind='f';
 if o is null then raise exception '함수가 없습니다'; end if;
 d:=pg_get_functiondef(o);
 i:=position(E'\n  /* close-lost-reasons-v1:start' in d);
 if i=0 then raise notice '적용 흔적 없음 — 건너뜀'; return; end if;
 j:=position(endtag in d);
 execute substr(d,1,i-1)||substr(d,j+length(endtag));
end $rb$;
commit;
