from django.test import SimpleTestCase

from api.menu_hierarchy import (
    MENU_HIERARCHY,
    get_admin_only_keys,
    get_all_menu_keys,
    is_valid_menu_key,
)


class MenuHierarchyTests(SimpleTestCase):
    def test_menu_keys_are_unique(self):
        keys = get_all_menu_keys()
        self.assertEqual(len(keys), len(set(keys)))

    def test_sidebar_granular_permissions_are_available(self):
        expected = {
            'ventes_avoirs_clients',
            'clients_consultation',
            'clients_imc',
            'inventaire_cadencier',
        }
        self.assertTrue(expected.issubset(set(get_all_menu_keys())))

    def test_removed_sidebar_entries_are_not_assignable(self):
        keys = set(get_all_menu_keys())
        self.assertNotIn('settings_facture', keys)
        self.assertNotIn('settings_whatsapp', keys)

    def test_admin_pages_remain_separate_from_assignable_hierarchy(self):
        hierarchy_keys = set(get_all_menu_keys())
        admin_keys = set(get_admin_only_keys())
        self.assertTrue(admin_keys.isdisjoint(hierarchy_keys))
        self.assertTrue(all(is_valid_menu_key(key) for key in admin_keys))

    def test_every_menu_has_a_translation_key(self):
        for menu in MENU_HIERARCHY:
            self.assertTrue(menu['labelKey'].startswith('sidebar:'))
            for submenu in menu.get('submenus', []):
                self.assertTrue(submenu['labelKey'].startswith('sidebar:'))
