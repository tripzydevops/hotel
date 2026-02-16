from backend.utils.room_normalizer import RoomTypeNormalizer

def test_normalization():
    test_cases = [
        # Standard cases
        ("Deluxe King Room", "KNG-DLX"),
        ("Standard Double Room", "DBL-STD"),
        ("Twin Superior Room with Sea View", "TW-SUP-SV"),
        
        # Turkish cases
        ("Standart Oda, 1 Cift Kişilik Yatak", "DBL-STD"), # Cift -> DBL, Standart -> STD
        ("Deluxe Oda, 1 En Büyük (King) Boy Yatak", "KNG-DLX"), # King -> KNG
        ("Aile Odası, Deniz Manzaralı", "FAM-SV"), # Aile->FAM, Deniz->SV
        
        # Complex / Weird cases
        ("Executive Suite with Balcony and Pool View", "STE-EXC-PV-BAL"),
        ("Promo Room (No Window)", "ECO"), 
        ("Grand Deluxe Partial Ocean View", "DLX-GRD-SV-PRT"),
        
        # Unmapped
        ("Super Duper Mystery Room", "ROH"),
        ("", "UNK"),
    ]
    
    print(f"{'RAW STRING':<50} | {'CODE':<20} | {'NAME'}")
    print("-" * 100)
    
    passed = 0
    for raw, expected_code in test_cases:
        result = RoomTypeNormalizer.normalize(raw)
        code = result["canonical_code"]
        name = result["canonical_name"]
        
        status = "✅" if (expected_code == "ROH" and code == "ROH") or code == expected_code else f"❌ (Exp: {expected_code})"
        
        # For "Promo Room" -> "ECO", we need 'promo' map
        # For "Partial", we need 'partial' map
        
        print(f"{raw:<50} | {code:<20} | {name} {status}")
        if "❌" not in status:
            passed += 1
            
    print("-" * 100)
    print(f"Passed {passed}/{len(test_cases)} tests.")

if __name__ == "__main__":
    test_normalization()
