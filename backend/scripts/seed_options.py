from api.models import ConfigurationOption

def run():
    # 1. Stock Adjustment Reasons
    adj_reasons = [
        ('INVENTAIRE', 'Ajustement Inventaire'),
        ('CASSE', 'Cesse / Endommagé'),
        ('VOL', 'Vol Confimé'),
        ('CONFUSION', 'Erreur de confusion'),
        ('ERREUR_ENTREE', 'Erreur de saisie entrée'),
        ('AVARIE', 'Avarie (Transport/Stockage)'),
        ('USAGE_INTERNE', 'Usage Interne / Consommation'),
        ('PEREMPTION', 'Péremption')
    ]

    for i, (code, label) in enumerate(adj_reasons):
        ConfigurationOption.objects.get_or_create(
            type='STOCK_ADJ',
            code=code,
            defaults={'label': label, 'order': i}
        )
    print(f"Seeded {len(adj_reasons)} adjustment reasons.")

    # 2. Supplier Return Reasons
    ret_reasons = [
        ('PERIME', 'Produit Périmé'),
        ('AVARIE', 'Produit Avarié (Cassé/Abîmé)'),
        ('NON_FACTURE', 'Reçu mais non facturé'),
        ('ERREUR_CMDE', 'Erreur de commande'),
        ('ERREUR_LIV', 'Erreur de livraison'),
        ('RAPPEL_LOT', 'Rappel de lot (Laboratoire)'),
        ('SURSTOCK', 'Surstock (Rotation lente)')
    ]

    for i, (code, label) in enumerate(ret_reasons):
        ConfigurationOption.objects.get_or_create(
            type='SUPPLIER_RET',
            code=code,
            defaults={'label': label, 'order': i}
        )
    print(f"Seeded {len(ret_reasons)} return reasons.")

    # 3. Money Denominations (CFA XAF)
    money_denoms = [
        ('B10000', 'Billet 10 000', '10000'),
        ('B5000', 'Billet 5 000', '5000'),
        ('B2000', 'Billet 2 000', '2000'),
        ('B1000', 'Billet 1 000', '1000'),
        ('B500', 'Billet 500', '500'),
        ('P500', 'Pièce 500', '500'),
        ('P100', 'Pièce 100', '100'),
        ('P50', 'Pièce 50', '50'),
        ('P25', 'Pièce 25', '25'),
        ('P10', 'Pièce 10', '10'),
        ('P5', 'Pièce 5', '5'),
    ]

    for i, (code, label, val) in enumerate(money_denoms):
        ConfigurationOption.objects.get_or_create(
            type='MONEY_DENOM',
            code=code,
            defaults={'label': label, 'value': val, 'order': i}
        )
    print(f"Seeded {len(money_denoms)} money denominations.")
