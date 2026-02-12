# Analysis Script Macros

Macros ini tersedia di dalam sandbox script analysis. Semua fungsi bersifat **read** kecuali `Attribute.set`/`Attribute.setMany` yang akan **update nilai attribute** (tidak menulis historian).

## Asset
### `Asset.get(path)`
Ambil data asset berdasarkan path.

**Contoh:**
```js
const pump = Asset.get("Plant A.Pump-01");
return { name: pump?.name };
```

### `Asset.list()`
Ambil semua asset (flat list).

**Contoh:**
```js
const assets = Asset.list();
return { count: assets.length };
```

### `Asset.query(pattern)`
Cari asset dengan wildcard `*` dan `?`.

**Contoh:**
```js
const pumps = Asset.query("Plant A.Pump-*");
return { pumps: pumps.map((p) => p.name) };
```

### `Asset.getHierarchy(path)`
Ambil parent chain dari root ke asset target.

**Contoh:**
```js
const chain = Asset.getHierarchy("Plant A.Pump-01");
return { chain };
```

## Attribute
### `Attribute.get(path)`
Ambil attribute berdasarkan path.

**Contoh:**
```js
const pressure = Attribute.get("Plant A.Pump-01.pressure");
return { value: pressure?.value, unit: pressure?.unit };
```

### `Attribute.list(assetPath)`
Ambil semua attribute untuk asset tertentu.

**Contoh:**
```js
const attrs = Attribute.list("Plant A.Pump-01");
return { names: attrs.map((a) => a.name) };
```

### `Attribute.getMany(paths)`
Ambil banyak attribute sekaligus.

**Contoh:**
```js
const rows = Attribute.getMany([
  "Plant A.Pump-01.pressure",
  "Plant A.Pump-01.temperature"
]);
return { rows };
```

### `Attribute.set(path, value)`
Update nilai attribute (latest value).

**Contoh:**
```js
Attribute.set("Plant A.Pump-01.pressure", 7.2);
return { ok: true };
```

### `Attribute.setMany(items)`
Update banyak attribute sekaligus.

**Contoh:**
```js
Attribute.setMany([
  { path: "Plant A.Pump-01.pressure", value: 7.1 },
  { path: "Plant A.Pump-01.temperature", value: 81 }
]);
return { ok: true };
```

## Notes
- Path format: `Root.Child.Asset.Attribute`
- `Attribute.set` **tidak** menulis ke historian.
- Error tipe value akan memunculkan response error dari API run.
