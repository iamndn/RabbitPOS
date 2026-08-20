import json

with open('/opt/RabbitPOS/backend/data/excel_dump.json', 'r', encoding='utf-8') as f:
    rows = json.load(f)

header = rows[0]
data_rows = rows[1:]

categories = {}
products = {}
variants = []

for idx, r in enumerate(data_rows):
    prod_name = r.get('A', '').strip()
    cat_name = r.get('B', '').strip()
    desc = r.get('C', '').strip()
    tag = r.get('D', '').strip()
    var_name = r.get('E', '').strip()
    sku = r.get('F', '').strip()
    cogs_str = r.get('G', '').strip()
    retail_str = r.get('H', '').strip()
    status_str = r.get('I', '').strip()
    img_url = r.get('J', '').strip()

    if not prod_name:
        continue

    try:
        cogs = float(cogs_str) if cogs_str else 0.0
    except:
        cogs = 0.0

    try:
        retail = float(retail_str) if retail_str else 0.0
    except:
        retail = 0.0

    is_active = False if status_str.lower() in ['không', 'khong', 'false', '0', 'no'] else True

    # Normalize tag
    tag_clean = 'none'
    if tag.lower() in ['best_seller', 'bestseller']:
        tag_clean = 'best_seller'
    elif tag.lower() in ['new', 'mới']:
        tag_clean = 'new'
    elif tag.lower() in ['featured', 'nổi bật']:
        tag_clean = 'featured'
    elif tag.lower() in ['suspended', 'tạm ngưng']:
        tag_clean = 'suspended'
    elif tag.lower() in ['coming_soon', 'sắp ra mắt']:
        tag_clean = 'coming_soon'

    if cat_name not in categories:
        categories[cat_name] = len(categories) + 1

    if prod_name not in products:
        products[prod_name] = {
            'category': cat_name,
            'description': desc,
            'tag': tag_clean,
            'image_url': img_url,
            'is_active': is_active,
            'variants': []
        }
    else:
        # update image or desc if not empty
        if img_url and not products[prod_name]['image_url']:
            products[prod_name]['image_url'] = img_url
        if desc and not products[prod_name]['description']:
            products[prod_name]['description'] = desc

    products[prod_name]['variants'].append({
        'variant_name': var_name,
        'sku': sku,
        'cogs_price': cogs,
        'retail_price': retail,
        'is_active': is_active
    })

print(f"Categories ({len(categories)}): {list(categories.keys())}")
print(f"Total Products: {len(products)}")
total_vars = sum(len(p['variants']) for p in products.values())
print(f"Total Variants: {total_vars}")

summary = {
    'categories': categories,
    'products': products
}

with open('/opt/RabbitPOS/backend/data/parsed_catalog.json', 'w', encoding='utf-8') as f:
    json.dump(summary, f, ensure_ascii=False, indent=2)

print("Saved parsed catalog to /opt/RabbitPOS/backend/data/parsed_catalog.json")
