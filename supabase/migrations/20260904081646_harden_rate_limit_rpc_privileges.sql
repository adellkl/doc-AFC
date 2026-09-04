begin;

-- This RPC is an internal service-role primitive. Explicitly revoke both the
-- implicit PUBLIC grant and the API roles so it cannot become callable if
-- schema permissions are relaxed later.
revoke execute on function public.enforce_application_submission_rate_limit(text)
from public, anon, authenticated;
grant execute on function public.enforce_application_submission_rate_limit(text)
to service_role;

-- New functions in the exposed public schema must opt in to API execution.
alter default privileges for role postgres in schema public
revoke execute on functions from public, anon, authenticated;

commit;
