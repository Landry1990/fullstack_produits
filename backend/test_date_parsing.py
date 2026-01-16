
from datetime import datetime
import sys

def test_parsing():
    # Format sent by frontend: date.toISOString().slice(0, 19)
    # Example: "2026-01-16T10:00:00"
    date_str = "2026-01-16T10:00:00"
    
    print(f"Testing parsing of: {date_str}")
    
    try:
        # Same logic as in views/ventes.py
        start_date = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
        print(f"Success: {start_date} (Type: {type(start_date)})")
        print(f"Timezone info: {start_date.tzinfo}")
    except ValueError as e:
        print(f"Error: {e}")

    # Test with Z just in case
    date_str_z = "2026-01-16T10:00:00Z"
    print(f"\nTesting parsing of: {date_str_z}")
    try:
        start_date = datetime.fromisoformat(date_str_z.replace('Z', '+00:00'))
        print(f"Success: {start_date}")
    except ValueError as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_parsing()
