CREATE FUNCTION ingest_group_scope(p_type text,p_file text,p_function text,p_template text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$ SELECT md5(COALESCE(p_type,'')||chr(31)||COALESCE(p_file,'')||chr(31)||COALESCE(p_function,'')||chr(31)||COALESCE(p_template,'')); $$;
CREATE INDEX issues_ingest_scope ON issues(project_id,ingest_group_scope(exception_type,grouping_anchor->>'file',grouping_anchor->>'function',grouping_anchor->>'template'),created_at DESC,id) WHERE merge_parent_id IS NULL;
