
from api.models.promotions import Promotion, PromotionPackItem
from api.models.products import Produit
from django.db import transaction

def run():
    print("Starting Promotion Deletion Debug...")
    
    # 1. Test Simple Promotion Deletion
    try:
        with transaction.atomic():
            p = Promotion.objects.create(name="Debug Promo Simple", discount_type='PERCENTAGE', value=10)
            print(f"Created simple promotion: {p.id}")
            p_id = p.id
            p.delete()
            print(f"Deleted simple promotion: {p_id}")
            if Promotion.objects.filter(id=p_id).exists():
                print("ERROR: Promotion still exists!")
            else:
                print("SUCCESS: Simple promotion deleted.")
    except Exception as e:
        print(f"EXCEPTION deleting simple promo: {e}")

    # 2. Test Bundle Promotion Deletion
    try:
        with transaction.atomic():
            # Ensure we have a product
            prod = Produit.objects.first()
            if not prod:
                prod = Produit.objects.create(name="Debug Product", selling_price=100)
                
            p_bundle = Promotion.objects.create(name="Debug Promo Bundle", discount_type='BUNDLE', value=500)
            print(f"Created bundle promotion: {p_bundle.id}")
            
            # Add items
            item = PromotionPackItem.objects.create(promotion=p_bundle, product=prod, quantity=2)
            print(f"Added pack item: {item.id}")
            
            p_bundle_id = p_bundle.id
            p_bundle.delete()
            print(f"Deleted bundle promotion: {p_bundle_id}")
            
            if Promotion.objects.filter(id=p_bundle_id).exists():
                print("ERROR: Bundle Promotion still exists!")
            else:
                print("SUCCESS: Bundle promotion deleted.")
                
            if PromotionPackItem.objects.filter(promotion_id=p_bundle_id).exists():
                 print("ERROR: Pack Items still exist!")
            else:
                 print("SUCCESS: Pack Items cleaned up.")
                 
    except Exception as e:
        print(f"EXCEPTION deleting bundle promo: {e}")

if __name__ == '__main__':
    run()
