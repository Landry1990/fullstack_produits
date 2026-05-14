#!/usr/bin/env python3
"""
Test script to verify stock_lots relationship works
"""
import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
django.setup()

from api.models import Produit, StockLot

def test_stock_lots_relationship():
    """Test that stock_lots relationship is accessible"""
    print("Testing stock_lots relationship...")
    
    # Get a produit
    produit = Produit.objects.first()
    if produit:
        print(f"Produit: {produit.name}")
        
        # Test accessing stock_lots
        try:
            stock_lots = produit.stock_lots.all()
            print(f"✅ stock_lots accessible: {stock_lots.count()} lots found")
            
            # Test the specific line from optimize_queries.py
            if produit.use_lot_management:
                lots_list = list(produit.stock_lots.all())
                print(f"✅ list(produit.stock_lots.all()) works: {len(lots_list)} lots")
            else:
                print("✅ produit.use_lot_management is False, skipping stock_lots access")
                
        except AttributeError as e:
            print(f"❌ Error accessing stock_lots: {e}")
            return False
        except Exception as e:
            print(f"❌ Other error: {e}")
            return False
    else:
        print("⚠️ No products found in database")
    
    return True

if __name__ == '__main__':
    test_stock_lots_relationship()
