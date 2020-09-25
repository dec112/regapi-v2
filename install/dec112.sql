
-- Uncomment this sql block if you want DEC112 to live
-- in its own database named "dec112"
-- WARNING: in that case comment or delete all schema actions like
-- create/drop schema, set search_path and schema prefixes e.g.
-- dec112.dblink -> dblink

--DROP DATABASE IF EXISTS dec112;
--CREATE DATABASE dec112
--  WITH OWNER = postgres
--       ENCODING = 'UTF8'
--       TABLESPACE = pg_default
--       LC_COLLATE = 'de_AT.UTF-8'
--       LC_CTYPE = 'de_AT.UTF-8'
--       CONNECTION LIMIT = -1
--       TEMPLATE template0;
--COMMENT ON DATABASE postgres
--  IS 'DEC112 - Deaf Emergency Call';
--\c dec112;


-- Use this code block to place dec112 data into
-- its own schema in an existing database ("postgres" is default"
\c postgres
DROP SCHEMA IF EXISTS dec112 CASCADE;
CREATE SCHEMA dec112;
SET search_path TO dec112;

-- create extensions
CREATE EXTENSION pgcrypto;
CREATE EXTENSION postgres_fdw;
CREATE EXTENSION dblink;

-- link to kamailio db
CREATE SERVER kamailio_server
  FOREIGN DATA WRAPPER postgres_fdw
  OPTIONS (host 'localhost', dbname 'kamailio');

CREATE USER MAPPING FOR CURRENT_USER
  SERVER kamailio_server
  OPTIONS (user 'postgres', password 'postgres');

IMPORT FOREIGN SCHEMA public
  LIMIT TO (subscriber)
  FROM SERVER kamailio_server
  INTO dec112;



-- ---------------------------------------------------------------------------
-- V1 API tables

CREATE TABLE devices (
  ID BIGSERIAL PRIMARY KEY,
  device_id VARCHAR,
  model VARCHAR,
  lang VARCHAR,
  "state" INTEGER,
  phone_number VARCHAR,
  owner_name TEXT,
  owner_address TEXT,
  owner_email TEXT,
  owner_token VARCHAR,
  owner_verified_ts TIMESTAMP WITHOUT TIME ZONE,
  phone_token VARCHAR,
  phone_verified_ts TIMESTAMP WITHOUT TIME ZONE,
  email_token VARCHAR,
  email_verified_ts TIMESTAMP WITHOUT TIME ZONE,
  registration_ts TIMESTAMP WITHOUT TIME ZONE,
  kamailio_id INTEGER
);

ALTER TABLE devices
  ADD CONSTRAINT devices_device_id UNIQUE (device_id);



-- Create state and kamailio update trigger
CREATE OR REPLACE FUNCTION calc_state() RETURNS TRIGGER
AS
$BODY$
DECLARE
  tmp_state int;
  domain varchar;
  pwd varchar;
  gen_user varchar;
  kamailio_id int;
BEGIN
  SET search_path TO dec112;
  tmp_state := 0;
  domain := 'service.dec112.at';

  IF NEW.owner_token = 'IGNORED' OR
      (NEW.owner_token IS NOT NULL AND NEW.owner_verified_ts IS NOT NULL) THEN
    tmp_state := tmp_state + 1;
  END IF;

  IF NEW.phone_token = 'IGNORED' OR
      (NEW.phone_token IS NOT NULL AND NEW.phone_verified_ts IS NOT NULL) THEN
    tmp_state := tmp_state + 1;
  END IF;

  IF NEW.email_token = 'IGNORED' OR
      (NEW.email_token IS NOT NULL AND NEW.email_verified_ts IS NOT NULL) THEN
    tmp_state := tmp_state + 1;
  END IF;

  IF tmp_state = 3 THEN
    NEW.state := 10;
  END IF;


  IF NEW.state = 0 OR NEW.state = 10 THEN

    -- if dblink connection to kamailio server das not exist - create it
    IF NOT ARRAY['ks'] <@ dec112.dblink_get_connections() OR dec112.dblink_get_connections() IS NULL THEN
      PERFORM dec112.dblink_connect('ks', 'kamailio_server');
    END IF;

    -- If device is deregistered
    IF NEW.state = 0 THEN
      PERFORM dblink_exec('ks',
        'delete from subscriber ' ||
          'where id = ' || NEW.kamailio_id || ';');
    END IF;

    -- If device is registered create or update kamailio db
    IF NEW.state = 10 THEN
      pwd := substring(MD5(dec112.gen_random_bytes(128)) from 0 for 25);
      gen_user := MD5(NEW.device_id || ':' || NEW.owner_name);

      -- This will NOT work when inserting into imported tables which
      -- have foreign sequences. Instead use dblink.

      --INSERT INTO dec112.subscriber (username, domain, password, ha1, ha1b)
      --VALUES (
      --  '101', 'test.com', 'test123',
      --  MD5('101:test.com:test123'),
      --  MD5('101@test.com:test.com:test123')
      --);

      SELECT id FROM dec112.dblink('ks',
          'INSERT INTO subscriber ' ||
            '(username, domain, password, ' ||
            'email_address, ' ||
            'ha1, ha1b) ' ||
          'VALUES(''' || gen_user || ''', ''' || domain || ''', ''' || pwd || ''', ' ||
            '''' || NEW.owner_email || ''',' ||
            'MD5(''' || gen_user || ':' || domain || ':' || pwd || '''), ' ||
            'MD5(''' || gen_user || '@' || domain || ':' || domain || ':' || pwd || ''')) ' ||
          'ON CONFLICT ON CONSTRAINT subscriber_account_idx DO UPDATE ' ||
            'SET username = EXCLUDED.username, ' ||
              'domain = EXCLUDED.domain, ' ||
              'password = EXCLUDED.password, ' ||
              'email_address = EXCLUDED.email_address, ' ||
              'ha1 = EXCLUDED.ha1, ' ||
              'ha1b = EXCLUDED.ha1b ' ||
          'RETURNING id;')
        AS t1(id INTEGER)
        INTO NEW.kamailio_id;
        --NEW.kamailio_id := kamailio_id
    END IF;
  END IF;

  RETURN NEW;
END;
$BODY$
LANGUAGE plpgsql;

CREATE TRIGGER calc_state_trigger
BEFORE INSERT OR UPDATE ON "devices"
FOR EACH ROW
EXECUTE PROCEDURE calc_state();



CREATE OR REPLACE FUNCTION delete_state() RETURNS TRIGGER
AS
$BODY$
BEGIN
  SET search_path TO dec112;
  IF NOT ARRAY['ks'] <@ dec112.dblink_get_connections() OR dec112.dblink_get_connections() IS NULL THEN
    PERFORM dec112.dblink_connect('ks', 'kamailio_server');
  END IF;

  PERFORM dec112.dblink_exec('ks',
    'delete from subscriber ' ||
      'where id = ' || OLD.kamailio_id || ';');

  RETURN OLD;
END;
$BODY$
LANGUAGE plpgsql;

CREATE TRIGGER delete_state_trigger
AFTER DELETE ON "devices"
FOR EACH ROW
EXECUTE PROCEDURE delete_state();



-- create some testing data
INSERT INTO devices
    (device_id, model, lang, "state", phone_number,
      owner_name, owner_address, owner_email,
      owner_token, phone_token, email_token,
      registration_ts)
    VALUES
      ('xyz4711', 'Google Nexus 6P', 'en', 1, '+43 1 12345',
      'Max Müller', 'Dortweg 99, Entenhausen', 'max@mueller.xyz',
      'IGNORED', 'jHhj34adh5gsa1G7', 'mH6fJ8g54fBg3qW2',
      '2013-12-20 20:45:27Z'),
      ('abc123', 'Apple iPhone 6SE', 'de', 2, '43 1 4711 0815',
      'Müller, Gärtner', 'Düsenstraße 22, Dort', 'x@y.com',
      'IGNORED', '98hGt5Fdr4FdLjuH', 'G2WaQ1mMMnHznn7U',
      '2016-12-22 10:51:27Z');



-- ---------------------------------------------------------------------------
-- V2 API tables

CREATE TABLE registrations (
  ID BIGSERIAL PRIMARY KEY,
  reg_id VARCHAR,
  model VARCHAR,
  lang VARCHAR,
  "state" INTEGER,
  phone_number VARCHAR,
  phone_token VARCHAR,
  phone_verified_ts TIMESTAMP WITHOUT TIME ZONE,
  phone_vcnt INTEGER,
  registration_ts TIMESTAMP WITHOUT TIME ZONE,
  did VARCHAR,
  kamailio_id INTEGER
);

ALTER TABLE registrations
  ADD CONSTRAINT registrations_reg_id UNIQUE (reg_id);



-- Create state and kamailio update trigger
CREATE OR REPLACE FUNCTION reg_set_state() RETURNS TRIGGER
AS
$BODY$
DECLARE
  tmp_state int;
  domain varchar;
  user varchar;
  pwd varchar;
  gen_user varchar;
  kamailio_id int;
BEGIN
  SET search_path TO dec112;
  tmp_state := 0;
  domain := 'service.dec112.at';

  IF NEW.phone_token = 'IGNORED' OR
      (NEW.phone_token IS NOT NULL AND NEW.phone_verified_ts IS NOT NULL) THEN
    tmp_state := tmp_state + 1;
  END IF;
  -- possible more validations here

  IF tmp_state = 1 THEN
    NEW.state := 10;
  END IF;


  IF NEW.state = 0 OR NEW.state = 10 THEN

    -- if dblink connection to kamailio server das not exist - create it
    IF NOT ARRAY['ks'] <@ dec112.dblink_get_connections() OR dec112.dblink_get_connections() IS NULL THEN
      PERFORM dec112.dblink_connect('ks', 'kamailio_server');
    END IF;

    -- If device is not fully registered
    IF NEW.state < 10 THEN
      PERFORM dblink_exec('ks',
        'delete from subscriber ' ||
          'where id = ' || NEW.kamailio_id || ';');
    END IF;

    -- If device is registered create or update kamailio db
    IF NEW.state = 10 THEN
      user := substring(MD5(dec112.gen_random_bytes(128)) from 0 for 25);
      pwd := substring(MD5(dec112.gen_random_bytes(128)) from 0 for 25);
      gen_user := MD5(NEW.reg_id || ':' || user);

      SELECT id FROM dec112.dblink('ks',
          'INSERT INTO subscriber ' ||
            '(username, domain, password, ' ||
            'ha1, ha1b) ' ||
          'VALUES(''' || gen_user || ''', ''' || domain || ''', ''' || pwd || ''', ' ||
            'MD5(''' || gen_user || ':' || domain || ':' || pwd || '''), ' ||
            'MD5(''' || gen_user || '@' || domain || ':' || domain || ':' || pwd || ''')) ' ||
          'ON CONFLICT ON CONSTRAINT subscriber_account_idx DO UPDATE ' ||
            'SET username = EXCLUDED.username, ' ||
              'domain = EXCLUDED.domain, ' ||
              'password = EXCLUDED.password, ' ||
              'ha1 = EXCLUDED.ha1, ' ||
              'ha1b = EXCLUDED.ha1b ' ||
          'RETURNING id;')
        AS t1(id INTEGER)
        INTO NEW.kamailio_id;

    END IF;
  END IF;

  RETURN NEW;
END;
$BODY$
LANGUAGE plpgsql;

CREATE TRIGGER reg_calc_set_trigger
BEFORE INSERT OR UPDATE ON "registrations"
FOR EACH ROW
EXECUTE PROCEDURE reg_set_state();



CREATE OR REPLACE FUNCTION reg_del_state() RETURNS TRIGGER
AS
$BODY$
BEGIN
  SET search_path TO dec112;
  IF NOT ARRAY['ks'] <@ dec112.dblink_get_connections() OR dec112.dblink_get_connections() IS NULL THEN
    PERFORM dec112.dblink_connect('ks', 'kamailio_server');
  END IF;

  PERFORM dec112.dblink_exec('ks',
    'delete from subscriber ' ||
      'where id = ' || OLD.kamailio_id || ';');

  RETURN OLD;
END;
$BODY$
LANGUAGE plpgsql;

CREATE TRIGGER reg_del_state_trigger
AFTER DELETE ON "registrations"
FOR EACH ROW
EXECUTE PROCEDURE reg_del_state();



-- create some testing data
INSERT INTO registrations
    (reg_id, model, lang, "state",
      phone_number, phone_token,
      registration_ts)
    VALUES
      ('xyz4711', 'Google Nexus 6P', 'en', 1,
	   '+43 1 12345', 'IGNORED',
      '2013-12-20 20:45:27Z'),
      ('abc123', 'Apple iPhone 6SE', 'de', 2,
	   '43 1 4711 0815', 'IGNORED',
      '2016-12-22 10:51:27Z');

