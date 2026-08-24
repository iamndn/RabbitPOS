#!/usr/bin/env python3
import psycopg2
import sys

conn = psycopg2.connect(
    host='localhost',
    port=5432,
    user='admin',
    password='SGsurv9wi7uQRXXniYj0kg1V8TunrUnR',
    dbname='rabbitpos'
)
cur = conn.cursor()

print("=== 5 First Orders ===", flush=True)
cur.execute("SELECT id, order_code, status, total_amount, cashier_name, created_at FROM orders ORDER BY created_at ASC LIMIT 5")
for r in cur.fetchall():
    print(" ", r, flush=True)

print("\n=== 5 Last Orders ===", flush=True)
cur.execute("SELECT id, order_code, status, total_amount, cashier_name, created_at FROM orders ORDER BY created_at DESC LIMIT 5")
for r in cur.fetchall():
    print(" ", r, flush=True)

print("\n=== 5 First Transactions ===", flush=True)
cur.execute("SELECT id, transaction_type, category, amount, cashier_name, created_at FROM transactions ORDER BY created_at ASC LIMIT 5")
for r in cur.fetchall():
    print(" ", r, flush=True)

print("\n=== 5 Last Transactions ===", flush=True)
cur.execute("SELECT id, transaction_type, category, amount, cashier_name, created_at FROM transactions ORDER BY created_at DESC LIMIT 5")
for r in cur.fetchall():
    print(" ", r, flush=True)

cur.close()
conn.close()
