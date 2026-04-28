"""
Business Analysis & Prediction Module

This module processes business data (sales, purchases, expenses, inventory,
suppliers, employees) fetched from Tally and provides actionable insights,
predictions, and simulations.

Constraints:
- Pure Python module
- Uses Pandas and NumPy
- Independent and reusable functions
- Handles missing or empty data safely
"""

import pandas as pd
import numpy as np
import json
from typing import List, Dict, Any

# ML Models
try:
    from prophet import Prophet
    import xgboost as xgb
    from sklearn.linear_model import LinearRegression
    ML_AVAILABLE = True
except ImportError:
    ML_AVAILABLE = False


def analyze_productivity(employee_data: List[Dict[str, Any]], sales_data: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Calculate sales per employee, productivity score, and detect if hiring is needed.
    """
    if not employee_data:
        return {"sales_per_employee": 0, "productivity_score": 0, "hiring_needed": False, "insight": "No employee data"}
        
    df_emp = pd.DataFrame(employee_data)
    total_sales = sum(item.get("amount", 0) for item in sales_data)
    
    if "sales_generated" in df_emp.columns:
        emp_sales = df_emp["sales_generated"].fillna(0).sum()
    else:
        emp_sales = total_sales

    num_employees = len(df_emp)
    sales_per_employee = emp_sales / num_employees if num_employees > 0 else 0
    
    # Baseline for 100% productivity (can be parameterized)
    baseline_sales = 100000.0 
    productivity_score = min(100.0, (sales_per_employee / baseline_sales) * 100) if sales_per_employee > 0 else 0
    
    # Heuristic: If employees are extremely productive (>90%), they might be at capacity
    hiring_needed = productivity_score > 90
    
    return {
        "sales_per_employee": round(sales_per_employee, 2),
        "productivity_score": round(productivity_score, 2),
        "hiring_needed": hiring_needed,
        "insight": "High productivity indicates potential need for hiring" if hiring_needed else "Productivity is manageable"
    }


def analyze_sales(sales_data: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Calculate daily average, monthly growth %, and detect sales trends.
    """
    if not sales_data:
        return {"daily_average": 0, "monthly_growth_pct": 0, "trend": "stable", "insights": "No sales data available"}
        
    df = pd.DataFrame(sales_data)
    df['date'] = pd.to_datetime(df['date'])
    df = df.sort_values('date')
    
    total_sales = df['amount'].sum()
    days = (df['date'].max() - df['date'].min()).days + 1
    daily_average = total_sales / days if days > 0 else total_sales
    
    # Calculate monthly growth
    df['month'] = df['date'].dt.to_period('M')
    monthly_sales = df.groupby('month')['amount'].sum()
    
    growth_pct = 0.0
    if len(monthly_sales) > 1:
        # Compare last month to previous month
        growth_pct = monthly_sales.pct_change().iloc[-1] * 100
        
    if pd.isna(growth_pct):
        growth_pct = 0.0
        
    trend = "increase" if growth_pct > 0 else "decrease" if growth_pct < 0 else "stable"
    
    return {
        "daily_average": round(daily_average, 2),
        "monthly_growth_pct": round(growth_pct, 2),
        "trend": trend,
        "insights": f"Sales trend is showing a {trend} with {round(growth_pct, 2)}% recent growth."
    }


def analyze_purchase(purchase_data: List[Dict[str, Any]], inventory_data: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Detect overstock, understock and suggest purchase optimizations.
    """
    if not inventory_data:
        return {"overstock_items": [], "understock_items": [], "dead_stock_pct": 0, "optimization_suggestion": "No inventory data"}
        
    df_inv = pd.DataFrame(inventory_data)
    
    # Heuristics for overstock/understock based on turnover_rate
    # Low turnover + high quantity = overstock
    # High turnover + low quantity = understock
    overstock = df_inv[(df_inv['quantity'] > 50) & (df_inv['turnover_rate'] < 1.0)]
    understock = df_inv[(df_inv['quantity'] < 20) & (df_inv['turnover_rate'] > 5.0)]
    
    dead_stock_pct = (len(overstock) / len(df_inv)) * 100 if len(df_inv) > 0 else 0
    
    return {
        "overstock_items": overstock['item'].tolist() if not overstock.empty else [],
        "understock_items": understock['item'].tolist() if not understock.empty else [],
        "dead_stock_pct": round(dead_stock_pct, 2),
        "optimization_suggestion": "Liquidate overstock items and re-order understock items immediately to maintain optimal levels."
    }


def rate_suppliers(supplier_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Score suppliers based on price, quality, and delivery speed, returning a ranked list.
    """
    if not supplier_data:
        return []
        
    df = pd.DataFrame(supplier_data)
    
    # Normalize price and delivery days to a 10-point scale (lower is better -> higher score)
    if 'price_score' not in df.columns:
        max_price = df['price'].max() if 'price' in df.columns else 1
        df['price_score'] = 10 - ((df.get('price', 0) / max_price) * 10) if max_price > 0 else 10
        
    if 'delivery_score' not in df.columns:
        max_days = df['delivery_days'].max() if 'delivery_days' in df.columns else 1
        df['delivery_score'] = 10 - ((df.get('delivery_days', 0) / max_days) * 10) if max_days > 0 else 10
        
    # Ensure quality score exists
    if 'quality_score' not in df.columns:
        df['quality_score'] = 5 # Default average score
        
    df['rating'] = (df['price_score'] + df['quality_score'] + df['delivery_score']) / 3
    df = df.sort_values(by='rating', ascending=False)
    
    return df[['name', 'rating']].to_dict('records')


def predict_business(sales_data: List[Dict[str, Any]], purchase_data: List[Dict[str, Any]], expense_data: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Predict weekly, monthly, and yearly projections using ML models (Prophet/XGBoost/Sklearn) if available, 
    otherwise fallback to moving average.
    """
    if not sales_data:
        return {"weekly": 0.0, "monthly": 0.0, "yearly": 0.0}
        
    df = pd.DataFrame(sales_data)
    if 'date' not in df.columns or 'amount' not in df.columns:
         return {"weekly": 0.0, "monthly": 0.0, "yearly": 0.0}

    df['date'] = pd.to_datetime(df['date'])
    daily_sales = df.groupby('date')['amount'].sum().reset_index().sort_values('date')
    
    weekly, monthly, yearly = 0.0, 0.0, 0.0

    if ML_AVAILABLE and len(daily_sales) >= 14:
        try:
            # Prophet Forecasting
            df_prophet = daily_sales.rename(columns={'date': 'ds', 'amount': 'y'})
            m = Prophet(daily_seasonality=True)
            m.fit(df_prophet)
            future = m.make_future_dataframe(periods=365)
            forecast = m.predict(future)
            
            # Extract predictions
            pred_weekly = forecast['yhat'].iloc[-365:-365+7].sum()
            pred_monthly = forecast['yhat'].iloc[-365:-365+30].sum()
            pred_yearly = forecast['yhat'].iloc[-365:].sum()
            
            weekly = float(pred_weekly)
            monthly = float(pred_monthly)
            yearly = float(pred_yearly)
        except Exception as e:
            pass # Fallback to basic if ML fails

    if weekly == 0.0:
        if len(daily_sales) < 7:
            avg_daily = daily_sales['amount'].mean()
            weekly = avg_daily * 7
            monthly = avg_daily * 30
            yearly = avg_daily * 365
        else:
            daily_sales['ma_7'] = daily_sales['amount'].rolling(window=7, min_periods=1).mean()
            recent_daily_avg = daily_sales['ma_7'].iloc[-1]
            if len(daily_sales) >= 30:
                past_period = daily_sales['amount'].iloc[-30:-15].mean()
                recent_period = daily_sales['amount'].iloc[-15:].mean()
                growth_rate = ((recent_period - past_period) / past_period) if past_period > 0 else 0.0
            else:
                growth_rate = 0.02
                
            weekly = recent_daily_avg * 7
            monthly = recent_daily_avg * 30 * (1 + growth_rate)
            yearly = recent_daily_avg * 365 * ((1 + growth_rate) ** 12)
        
    return {
        "weekly": round(weekly, 2),
        "monthly": round(monthly, 2),
        "yearly": round(yearly, 2)
    }


def simulate_changes(sales_data: List[Dict[str, Any]], purchase_data: List[Dict[str, Any]], expense_data: List[Dict[str, Any]], sales_change_pct: float, purchase_change_pct: float) -> Dict[str, Any]:
    """
    Simulate impact of percentage changes on sales and purchases on final profit.
    """
    total_sales = sum(item.get("amount", 0) for item in sales_data)
    total_purchases = sum(item.get("amount", 0) for item in purchase_data)
    total_expenses = sum(item.get("amount", 0) for item in expense_data)
    
    old_profit = total_sales - total_purchases - total_expenses
    
    new_sales = total_sales * (1 + sales_change_pct / 100.0)
    new_purchases = total_purchases * (1 + purchase_change_pct / 100.0)
    new_profit = new_sales - new_purchases - total_expenses
    
    difference = new_profit - old_profit
    
    return {
        "old_profit": round(old_profit, 2),
        "new_profit": round(new_profit, 2),
        "difference": round(difference, 2)
    }


def generate_suggestions(results: Dict[str, Any], total_sales: float, old_profit: float) -> List[str]:
    """
    Generate rule-based business actions.
    """
    suggestions = []
    
    # 1. Profit Margin Rule
    profit_margin = (old_profit / total_sales * 100) if total_sales > 0 else 0
    if 0 < profit_margin < 10:
        suggestions.append(f"Profit margin is extremely low ({round(profit_margin, 2)}%). Strongly suggest increasing sales volume or cutting operational costs.")
        
    # 2. Inventory Dead Stock Rule
    purch = results.get("purchase_analysis", {})
    if purch.get("dead_stock_pct", 0) > 20:
        suggestions.append("Inventory dead stock is over 20%. Consider a clearance sale to free up capital.")
        
    # 3. Supplier Rating Rule
    suppliers = results.get("supplier_ranking", [])
    poor_suppliers = [s['name'] for s in suppliers if s.get('rating', 10) < 3.0]
    if poor_suppliers:
        suggestions.append(f"Suppliers ({', '.join(poor_suppliers)}) have a rating below 3.0. Suggest finding replacements.")
        
    # 4. Productivity Rule
    prod = results.get("productivity", {})
    if prod.get("productivity_score", 100) < 40:
        suggestions.append("Overall employee productivity is low. Suggest initiating training programs.")
    elif prod.get("hiring_needed", False):
        suggestions.append("High sales per employee detected. Suggest hiring additional staff to prevent burnout.")
        
    if not suggestions:
        suggestions.append("Business metrics look stable. Focus on gradual scaling and maintaining current operational efficiencies.")
        
    return suggestions


def run_business_brain(
    sales_data: List[Dict[str, Any]],
    purchase_data: List[Dict[str, Any]],
    expense_data: List[Dict[str, Any]],
    inventory_data: List[Dict[str, Any]],
    supplier_data: List[Dict[str, Any]],
    employee_data: List[Dict[str, Any]]
) -> str:
    """
    Orchestrates the entire analysis pipeline and returns the final JSON output.
    """
    try:
        results = {
            "productivity": analyze_productivity(employee_data, sales_data),
            "sales_analysis": analyze_sales(sales_data),
            "purchase_analysis": analyze_purchase(purchase_data, inventory_data),
            "supplier_ranking": rate_suppliers(supplier_data),
            "prediction": predict_business(sales_data, purchase_data, expense_data),
            # Default simulation: what if sales grow 10% and purchases drop 5%?
            "simulation": simulate_changes(sales_data, purchase_data, expense_data, 10.0, -5.0)
        }
        
        # Calculate raw totals for suggestions
        total_sales = sum(item.get("amount", 0) for item in sales_data)
        old_profit = results["simulation"]["old_profit"]
        
        results["suggestions"] = generate_suggestions(results, total_sales, old_profit)
        
        return json.dumps(results, indent=2)
        
    except Exception as e:
        return json.dumps({"error": f"Failed to run analysis: {str(e)}"}, indent=2)
