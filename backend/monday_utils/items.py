
import os
import requests
from dotenv import load_dotenv

load_dotenv()

MONDAY_API_KEY = os.getenv("MONDAY_API_KEY")
MONDAY_API_URL = os.getenv("MONDAY_API_URL")
SUPPLIER_SORTING_ITEM_ID = os.getenv("SUPPLIER_SORTING_ITEM_ID")
COURIER_SORTING_ITEM_ID = os.getenv("COURIER_SORTING_ITEM_ID")


def fetch_item_with_columns(item_id):

    headers = { 
    "Authorization": MONDAY_API_KEY,
    "Content-Type": "application/json"
    }

    query = f"""
    query {{
      items(ids: {item_id}) {{
        id
        name
         column_values {{
              column {{ title }}
              id
              text
              value
              ... on MirrorValue {{
                  display_value
                  text
                  value
              }}
              ... on BoardRelationValue {{
                  linked_item_ids
                  display_value            
              }}
              ... on FormulaValue {{
                  value
                  id
                  display_value
              }}
        }}
      }}
    }}
    """

    response = requests.post(MONDAY_API_URL, json={"query": query}, headers=headers)
    data = response.json()

    if "errors" in data:
        print("Error:", data["errors"])
        return None

    items = data["data"]["items"]
    if not items:
        print(f"No item found with id {item_id}")
        return None

    return items[0]


def get_related_items(boardId , columnId, campare_vales):

    print('enter in this get_related_items',flush=True)
    

    headers = {
        "Authorization": MONDAY_API_KEY,
        "Content-Type": "application/json"
    }

    # compare_values_str = ",".join([f"\"{val}\"" for val in campare_vales])

    lineitems_query = f"""
            query {{
            boards(ids: {boardId}) {{
                items_page(query_params: {{rules: [ {{ column_id: "{columnId}", compare_value: {campare_vales} }}] , operator: or}}) {{
                cursor
                items {{
                    id
                    name
                    column_values {{
                      column {{ title }}
                      id
                      text
                      value
                      ... on MirrorValue {{ display_value text value }}
                      ... on BoardRelationValue {{ linked_item_ids display_value }}
                      ... on FormulaValue {{ value id display_value }}
                    }}
                }}
                }}
            }}
            }}
        """

    response = requests.post(MONDAY_API_URL, headers=headers, json={"query": lineitems_query})
    response.raise_for_status()
    response_json = response.json()
    print(" JSON ---->", response_json)

    boards = response_json["data"]["boards"]
    for board in boards:
        items_page = board.get("items_page", {})
        items = items_page.get("items", [])

    print('Suppliers items-->',items)
    return items

# Direct supplier sorting using weighted formula
def sort_suppliers_direct(suppliers):
    print('enter sort suppliers')
    if not suppliers or len(suppliers) <= 1:
        return suppliers

    # Extract values
    prices = [float(s.get('price', 0)) for s in suppliers if s.get('price') is not None]
    ratings = [float(s.get('rating', 0)) for s in suppliers if s.get('rating') is not None]

    print('prices---->',prices)
    print('ratings--->',ratings)

    if not prices or not ratings:
        return suppliers

    # Find min and max
    min_price, max_price = min(prices), max(prices)
    min_rating, max_rating = min(ratings), max(ratings)

    weights = get_weightage_values()

    # Score each supplier
    scored_suppliers = []
    for supplier in suppliers:
        price = float(supplier.get('price', 0))
        rating = float(supplier.get('rating', 0))

        # Normalize
        normalized_rating = 1 if max_rating == min_rating else (rating - min_rating) / (max_rating - min_rating)
        normalized_price = 1 if max_price == min_price else (max_price - price) / (max_price - min_price)

        # Apply weights: Price = 0.55, Rating = 0.45
        # final_score = (0.55 * normalized_price) + (0.45 * normalized_rating)
        final_score = (weights["supplier_price"] * normalized_price) + \
                      (weights["supplier_rating"] * normalized_rating)
        

        scored_suppliers.append({**supplier, 'final_score': final_score})
    print('scored_suppliers_4545-->',scored_suppliers)

    # Sort best to worst
    return sorted(scored_suppliers, key=lambda x: x['final_score'], reverse=True)


# Direct courier sorting using weighted formula
def sort_couriers_direct(couriers):
    
    print("Input couriers:", [c.get('courier_name') for c in couriers])
    print("Complete first courier:", couriers[0] if couriers else "No couriers")

    if not couriers or len(couriers) <= 1:
        return couriers

    # Extract values
    ratings = [float(c.get('rating', 0)) for c in couriers if c.get('rating') is not None]
    days = [float(c.get('estimated_delivery_days', 0)) for c in couriers if c.get('estimated_delivery_days') is not None]
    charges = [float(c.get('freight_charge', 0)) for c in couriers if c.get('freight_charge') is not None]

    if not ratings or not days or not charges:
        return couriers

    # Find min and max
    min_rating, max_rating = min(ratings), max(ratings)
    min_days, max_days = min(days), max(days)
    min_charge, max_charge = min(charges), max(charges)

    weights = get_weightage_values()
    print("Using weights:", weights, flush=True)


    # Score each courier
    scored_couriers = []
    for courier in couriers:
        rating = float(courier.get('rating', 0))
        delivery_days = float(courier.get('estimated_delivery_days', 0))
        freight_charge = float(courier.get('freight_charge', 0))

        # Normalize
        rating_score = 1 if max_rating == min_rating else (rating - min_rating) / (max_rating - min_rating)
        speed_score = 1 if max_days == min_days else 1 - (delivery_days - min_days) / (max_days - min_days)
        cost_score = 1 if max_charge == min_charge else 1 - (freight_charge - min_charge) / (max_charge - min_charge)

        # Apply weights: Rating = 0.35, Speed = 0.25, Cost = 0.40
        # final_score = (0.35 * rating_score) + (0.25 * speed_score) + (0.40 * cost_score)
        final_score = (weights["courier_rating"] * rating_score) + \
                     (weights["courier_delivery_days"] * speed_score) + \
                     (weights["courier_price"] * cost_score)
        
        scored_couriers.append({**courier, 'final_score': final_score})
        print(f"Courier {courier.get('courier_name')} scored {final_score}", flush=True)

    # Sort best to worst
    # return sorted(scored_couriers, key=lambda x: x['final_score'], reverse=True)
    sorted_couriers = sorted(scored_couriers, key=lambda x: x['final_score'], reverse=True)
    print("Sorted Couriers:", [c.get('courier_name') for c in sorted_couriers])

    return sorted_couriers
    



# Fetch weightage values from Monday.com items
def get_weightage_values():
    try:
              
        item_ids_list = [SUPPLIER_SORTING_ITEM_ID, COURIER_SORTING_ITEM_ID]
        print('item_ids_list--->',item_ids_list)
        
        # Default weights
        weights = {
            "courier_rating": 0.35,
            "courier_delivery_days": 0.25, 
            "courier_price": 0.40,
            "supplier_price": 0.55,
            "supplier_rating": 0.45
        }

        item_ids_str = ', '.join([str(id) for id in item_ids_list])
        print('item_ids_str--->',item_ids_str)

        headers = {
            "Authorization": MONDAY_API_KEY,
            "Content-Type": "application/json"
        }

        # 1. Fetch the order details
        order_query = f"""
        query {{
          items (ids: [{item_ids_str}]) {{
            id
            name
            column_values {{
              column {{ title }}
              id
              text
              value
              ... on MirrorValue {{
                  display_value
                  text
                  value
              }}
              ... on BoardRelationValue {{
                  linked_item_ids
                  display_value            
              }}
              ... on FormulaValue {{
                  value
                  id
                  display_value
              }}
            }}
          }}
        }}
        """

        try:
            order_response = requests.post(MONDAY_API_URL, headers=headers, json={"query": order_query})
            order_response.raise_for_status()
            order_data = order_response.json()
        except requests.exceptions.RequestException as e:
            print(f"Network error fetching items details: {e}")
            return None
        except ValueError as e:
            print(f"Error parsing JSON for items details: {e}")
            return None
        
        try:
            items = order_data["data"]["items"]
        except (KeyError, IndexError, TypeError) as e:
            print(f"Error extracting order item: {e}")
            return None
        
        # Extract weights from items
        for item in items:
            item_name = item.get("name", "")
            
            if item_name == "Courier_Sorting":
              
              weights["courier_rating"] = float(get_value("Rating",item))
              weights["courier_delivery_days"] = float(get_value("Estimated Delivery Days",item))
              weights["courier_price"] = float(get_value("Price",item))
            
            elif item_name == "Supplier_Sorting":
                    
              weights["supplier_price"] = float(get_value("Price",item))
              weights["supplier_rating"] = float(get_value("Rating",item))
        
        print("Using weights:", weights, flush=True)
        return weights
        
    except Exception as e:
        print(f"Error fetching weights: {e}", flush=True)
        # Return default weights if fetch fails
        return {
            "courier_rating": 0.35,
            "courier_delivery_days": 0.25,
            "courier_price": 0.40,
            "supplier_price": 0.55,
            "supplier_rating": 0.45
        }
    
def get_value(title,item):
    for col in item["column_values"]:
        if col["column"]["title"] == title:
            return col.get("text") or col.get("value") or col.get("display_value")
    return None


# Fetch the column ID dynamically from a board in Monday.com by column title.
def get_column_id(board_id, column_title):
  
    print("Board_id---->",board_id)
    
    query = """
    query ($boardId: [ID!]) {
        boards (ids: $boardId) {
            id
            name
            columns {
                id
                title
                type
            }
        }
    }
    """
    
    variables = {"boardId": board_id}
    
    headers = {
        "Authorization": MONDAY_API_KEY,
        "Content-Type": "application/json"
    }
    
    response = requests.post(
        MONDAY_API_URL,
        json={"query": query, "variables": variables},
        headers=headers
    )
    
    data = response.json()
    
    if "errors" in data:
        raise Exception(f"GraphQL Error: {data['errors']}")
    
    columns = data["data"]["boards"][0]["columns"]
    print("columns--->", columns)
    
    for col in columns:
        if col["title"] == column_title:
            return col["id"]
    
    return None
