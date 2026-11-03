-- One delivery destination, shared by projects within the same workspace.
ALTER TABLE alert_channels ADD COLUMN project_ids uuid[] NOT NULL DEFAULT '{}';
UPDATE alert_channels SET project_ids = ARRAY[project_id];

CREATE FUNCTION alert_channel_project_membership() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'UPDATE' AND NEW.project_id IS DISTINCT FROM OLD.project_id
       AND NEW.project_ids IS NOT DISTINCT FROM OLD.project_ids THEN
        NEW.project_ids := ARRAY[NEW.project_id];
    END IF;
    IF cardinality(NEW.project_ids) = 0 THEN NEW.project_ids := ARRAY[NEW.project_id]; END IF;
    NEW.project_id := NEW.project_ids[1];
    RETURN NEW;
END;
$$;
CREATE TRIGGER alert_channel_project_membership BEFORE INSERT OR UPDATE ON alert_channels
FOR EACH ROW EXECUTE FUNCTION alert_channel_project_membership();
ALTER TABLE alert_channels ADD CONSTRAINT alert_channel_projects_valid CHECK (
    cardinality(project_ids) BETWEEN 1 AND 100 AND array_position(project_ids, NULL) IS NULL
    AND project_id = project_ids[1]
);
CREATE INDEX alert_channels_projects_idx ON alert_channels USING gin(project_ids);
DROP POLICY alert_channels_tenant ON alert_channels;
CREATE POLICY alert_channels_tenant ON alert_channels FOR ALL
USING (org_id = current_setting('app.current_org_id', true)::uuid)
WITH CHECK (
    org_id = current_setting('app.current_org_id', true)::uuid
    AND NOT EXISTS (
        SELECT 1 FROM unnest(project_ids) pid
        WHERE NOT EXISTS (SELECT 1 FROM projects p WHERE p.id = pid AND p.org_id = alert_channels.org_id)
    )
);

-- Deleting one project detaches it; a shared destination survives for the others.
-- The existing project FK still removes a destination's last association.
CREATE FUNCTION detach_shared_output_channels() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    UPDATE alert_channels SET project_ids = array_remove(project_ids, OLD.id),
        project_id = (array_remove(project_ids, OLD.id))[1]
    WHERE org_id = OLD.org_id AND OLD.id = ANY(project_ids)
      AND cardinality(array_remove(project_ids, OLD.id)) > 0;
    UPDATE webhooks w SET project_id = c.project_id FROM alert_channels c
    WHERE c.org_id = OLD.org_id AND c.config->>'webhook_id' = w.id::text
      AND w.project_id = OLD.id AND c.project_id <> OLD.id;
    RETURN OLD;
END;
$$;
CREATE TRIGGER detach_shared_output_channels BEFORE DELETE ON projects
FOR EACH ROW EXECUTE FUNCTION detach_shared_output_channels();
