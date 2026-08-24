#!/usr/bin/env python3
import psycopg2

conn = psycopg2.connect(
    host='localhost',
    port=5432,
    user='admin',
    password='SGsurv9wi7uQRXXniYj0kg1V8TunrUnR',
    dbname='rabbitpos'
)
cur = conn.cursor()

cur.execute("""
    SELECT p.id, p.name, pv.id, pv.variant_name, pv.retail_price 
    FROM products p 
    JOIN product_variants pv ON pv.product_id = p.id 
    WHERE p.name ILIKE '%DƯA HẤU + DỨA%' OR p.name ILIKE '%DƯA HẤU%DỨA%'
""")
variants = cur.fetchall()
print("Variants for DƯA HẤU + DỨA:", flush=True)
for v in variants:
    print(" ", v, flush=True)

cur.execute("""
    SELECT oi.id, oi.order_id, oi.product_variant_id, oi.unit_price, oi.quantity, pv.variant_name
    FROM order_items oi
    JOIN product_variants pv ON pv.id = oi.product_variant_id
    WHERE pv.variant_name = 'Mặc định'
""")
items = cur.fetchall()
print(f"\nOrder items referencing Mặc định: {len(items)}", flush=True)
for item in items:
    print(" ", item, flush=True)

cur.close()
conn.close()
