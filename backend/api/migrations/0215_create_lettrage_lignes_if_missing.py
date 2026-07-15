from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0214_pharmacysettings_last_stock_analytics_run'),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
            CREATE TABLE IF NOT EXISTS api_lettrage_lignes (
                id bigserial NOT NULL PRIMARY KEY,
                lettrage_id bigint NOT NULL REFERENCES api_lettrage(id) DEFERRABLE INITIALLY DEFERRED,
                ligneecriture_id bigint NOT NULL REFERENCES api_ligneecriture(id) DEFERRABLE INITIALLY DEFERRED,
                CONSTRAINT api_lettrage_lignes_lettrage_id_ligneecriture_id_key UNIQUE (lettrage_id, ligneecriture_id)
            );
            CREATE INDEX IF NOT EXISTS api_lettrage_lignes_lettrage_id_idx ON api_lettrage_lignes (lettrage_id);
            CREATE INDEX IF NOT EXISTS api_lettrage_lignes_ligneecriture_id_idx ON api_lettrage_lignes (ligneecriture_id);
            """,
            reverse_sql="DROP TABLE IF EXISTS api_lettrage_lignes CASCADE;",
        ),
    ]
