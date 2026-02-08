
def assign_quadrant(ari, sentiment_index):
    quadrant_x = max(-50, min(50, ari - 100))
    quadrant_y = max(-50, min(50, sentiment_index - 100))
    
    if ari >= 100 and sentiment_index >= 100:
        q_label = "Premium King"
    elif ari < 100 and sentiment_index >= 100:
        q_label = "Value Leader"
    elif ari >= 100 and sentiment_index < 100:
        q_label = "Danger Zone"
    else:
        q_label = "Budget / Economy"
    
    return round(float(quadrant_x), 1), round(float(quadrant_y), 1), q_label

# Test cases (ARI, Sentiment, Expected)
test_cases = [
    (110, 110, (10.0, 10.0, "Premium King")),
    (90, 110, (-10.0, 10.0, "Value Leader")),
    (110, 80, (10.0, -20.0, "Danger Zone")),
    (80, 80, (-20.0, -20.0, "Budget / Economy")),
    (160, 160, (50.0, 50.0, "Premium King")), # Capping test
    (40, 40, (-50.0, -50.0, "Budget / Economy")), # Capping test
]

for ari, sent, expected in test_cases:
    res = assign_quadrant(ari, sent)
    assert res == expected, f"Failed for ARI={ari}, Sent={sent}. Expected {expected}, got {res}"
    print(f"Passed: ARI={ari}, Sent={sent} -> {res}")

print("\nAll quadrant logic tests passed!")
