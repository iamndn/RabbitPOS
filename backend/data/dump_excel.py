import zipfile, xml.etree.ElementTree as ET, json

with zipfile.ZipFile('/opt/RabbitPOS/sanphamvathuoctinh.xlsx') as z:
    shared_strings = []
    if 'xl/sharedStrings.xml' in z.namelist():
        tree = ET.fromstring(z.read('xl/sharedStrings.xml'))
        for si in tree.findall('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}si'):
            t = si.find('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t')
            if t is not None:
                shared_strings.append(t.text or '')
            else:
                text_parts = [r.find('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t').text or '' 
                              for r in si.findall('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}r')
                              if r.find('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t') is not None]
                shared_strings.append(''.join(text_parts))

    sheet_tree = ET.fromstring(z.read('xl/worksheets/sheet1.xml'))
    rows = []
    for r in sheet_tree.findall('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}sheetData/{http://schemas.openxmlformats.org/spreadsheetml/2006/main}row'):
        row_cells = {}
        for c in r.findall('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}c'):
            cell_ref = c.attrib.get('r', '')
            col_letter = ''.join([ch for ch in cell_ref if ch.isalpha()])
            val = ''
            v = c.find('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}v')
            t = c.attrib.get('t')
            if v is not None and v.text is not None:
                if t == 's':
                    idx = int(v.text)
                    val = shared_strings[idx] if idx < len(shared_strings) else ''
                else:
                    val = v.text
            row_cells[col_letter] = val
        if row_cells:
            rows.append(row_cells)

with open('/opt/RabbitPOS/backend/data/excel_dump.json', 'w', encoding='utf-8') as f:
    json.dump(rows, f, ensure_ascii=False, indent=2)

print(f"Extracted {len(rows)} rows successfully to /opt/RabbitPOS/backend/data/excel_dump.json")
