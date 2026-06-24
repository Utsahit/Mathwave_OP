# Frontend Compatibility Mapping: menu.json → Menu API

This mapping report documents how the frontend `menu.html` page's consumption of hardcoded `menu.json` matches and translates to the new dynamic `GET /api/v1/menu/public` API response.

---

## 1. Structure Comparison

### Old Static Structure (`menu.json`)
```json
{
  "items": [
    {
      "id": "malabar-cold-brew",
      "name": "Malabar Cold Brew",
      "category": "coffees",
      "description": "House-steeped 18 hrs with cardamom and dark chocolate.",
      "price": "₹450",
      "image": "cbc.webp",
      "tag": "SIGNATURE"
    }
  ]
}
```

### New API Structure (`GET /api/v1/menu/public`)
```json
{
  "success": true,
  "message": "Public menu retrieved successfully.",
  "data": {
    "categories": [
      {
        "id": "e3da219e-e3dd-4bbf-a292-cc234dbe234d",
        "name": "Coffees",
        "slug": "coffees",
        "description": "Artisanal single-origin brews and specialty espresso extractions.",
        "items": [
          {
            "id": "c1da245e-a222-4411-9a9a-ab88d234d234",
            "name": "Malabar Cold Brew",
            "slug": "malabar-cold-brew",
            "description": "House-steeped 18 hrs with cardamom and dark chocolate.",
            "price": 450.00,
            "image": "cbc.webp",
            "tag": "SIGNATURE",
            "tags": ["SIGNATURE"],
            "isFeatured": true,
            "isActive": true
          }
        ]
      }
    ]
  },
  "meta": {}
}
```

---

## 2. JavaScript Integration Patch

By applying this updated `loadMenuData()` function in `frontend/menu.html`, the front-end will render dynamically loaded API data without changes to the rest of the template:

```javascript
async function loadMenuData() {
  try {
    const response = await fetch('/api/v1/menu/public');
    if (!response.ok) throw new Error('Unable to load menu API');
    const json = await response.json();
    
    // Flatten category items array to remain compatible with old local render code
    menuData = [];
    if (json.success && json.data && json.data.categories) {
      json.data.categories.forEach(cat => {
        cat.items.forEach(item => {
          menuData.push({
            id: item.slug,
            name: item.name,
            category: cat.slug,
            description: item.description,
            price: typeof item.price === 'number' ? `₹${item.price.toLocaleString('en-IN')}` : item.price,
            image: item.image,
            tag: item.tag
          });
        });
      });
    }
  } catch (error) {
    console.error('Menu load error:', error);
    menuData = [];
  }

  renderMenuItems('coffees');
}
```
