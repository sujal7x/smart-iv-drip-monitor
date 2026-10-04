"""
prediction.py
-------------
Mathematical calculation and prediction module for Smart IV Drip Monitor.

DISCLAIMER:
This calculation is designed strictly for a student demonstration prototype
(Aavishkar project) and must NOT be presented as a clinically validated
medical prediction.
"""

def determine_status(drop_rate: float) -> tuple[str, str]:
    """
    Evaluates the infusion status based on the measured drop rate.
    
    Rules:
    - NORMAL:   drop_rate >= 10 drops/min
    - LOW_FLOW: 0 < drop_rate < 10 drops/min
    - CRITICAL: drop_rate == 0 drops/min
    
    Returns:
        (status_string, human_readable_message)
    """
    if drop_rate >= 10:
        return "NORMAL", "IV flow normal"
    elif drop_rate > 0:
        return "LOW_FLOW", "IV flow is slower than expected"
    else:
        return "CRITICAL", "IV flow stopped"


def calculate_predictions(drop_rate: float, current_volume: float, bottle_capacity: float) -> tuple[float, float | None]:
    """
    Calculates the remaining percentage and estimated time until the IV bottle empties.
    
    Assumptions:
    - Standard IV drip factor: 1 drop ≈ 0.05 mL (20 drops = 1 mL)
    - flow_ml_per_min = drop_rate * 0.05 mL/min
    - estimated_empty_minutes = current_volume / flow_ml_per_min
    
    If drop_rate is 0 (flow stopped):
    - estimated_empty_minutes is None (cannot empty if not flowing)
    
    Returns:
        (remaining_percent, estimated_empty_minutes)
    """
    # 1. Calculate remaining volume percentage
    if bottle_capacity > 0:
        remaining_percent = round((current_volume / bottle_capacity) * 100, 1)
        # Clamp between 0% and 100%
        remaining_percent = max(0.0, min(100.0, remaining_percent))
    else:
        remaining_percent = 0.0

    # 2. Calculate estimated empty time in minutes
    if drop_rate > 0 and current_volume > 0:
        # 1 drop ≈ 0.05 mL
        flow_ml_per_min = drop_rate * 0.05
        estimated_empty_minutes = round(current_volume / flow_ml_per_min, 1)
    else:
        # If flow has stopped or bottle is already 0 mL
        estimated_empty_minutes = None

    return remaining_percent, estimated_empty_minutes
