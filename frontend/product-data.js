window.MAVORYI_PRODUCTS = [
    {
        id: "nomad",
        name: "THE NOMAD",
        category: "Travel bag",
        image: "bag1.jpeg",
        color: "Black",
        material: "Nylon Fabric",
        price: null
    },
    {
        id: "hauler",
        name: "THE HAULER",
        category: "Travel bag",
        image: "bag2.jpeg",
        color: "Black",
        material: "Coated Fabric",
        price: null
    },
    {
        id: "inferno-helmet",
        name: "INFERNO-HELMET",
        category: "Helmet",
        image: "helmet1.jpeg",
        color: "Electric Blue and Black",
        material: "ABS Shell / PC Visor",
        price: null
    },
    {
        id: "nimbus",
        name: "NIMBUS",
        category: "Umbrella",
        image: "umb1.jpeg",
        color: "Black",
        material: "8-Rib Full Fibre Frame",
        price: null,
        variants: [
            { name: "NIMBUS", color: "Black", image: "umb1.jpeg" },
            { name: "STRATUS", color: "Wine", image: "umb2.jpeg" },
            { name: "THE BULL", color: "Blue", image: "umb3.jpeg" }
        ]
    },
    {
        id: "voyager",
        name: "THE VOYAGER",
        category: "Travel bag",
        image: "bag3.jpeg",
        color: "Charcoal Grey",
        material: "Ballistic Nylon",
        price: null
    },
    {
        id: "courier",
        name: "THE COURIER",
        category: "Travel bag",
        image: "bag4.jpeg",
        color: "Olive Green",
        material: "Waxed Canvas",
        price: null
    },
    {
        id: "vortex-helmet",
        name: "VORTEX-HELMET",
        category: "Helmet",
        image: "helmet 2.jpeg",
        color: "Matte Black",
        material: "Carbon Fibre Shell / PC Visor",
        price: null
    },
    {
        id: "sentinel",
        name: "THE SENTINEL",
        category: "Gloves",
        image: null,
        color: "Black",
        material: "Full-Grain Leather",
        price: null
    }
];

(function () {
    var config = window.MAVORYI_SUPABASE_CONFIG || {};
    var library = window.supabase;

    window.MAVORYI_CATALOG_READY = Promise.resolve(window.MAVORYI_PRODUCTS);

    if (!config.url || !config.anonKey || !library || !library.createClient) {
        return;
    }

    window.MAVORYI_CATALOG_READY = library.createClient(config.url, config.anonKey)
        .from("products")
        .select("id, name, category, image, color, material, price")
        .eq("active", true)
        .order("position", { ascending: true })
        .then(function (result) {
            if (result.error || !Array.isArray(result.data) || result.data.length === 0) {
                return window.MAVORYI_PRODUCTS;
            }

            var localById = {};
            window.MAVORYI_PRODUCTS.forEach(function (product) {
                localById[product.id] = product;
            });
            var catalog = result.data.filter(function (product) {
                return product.id !== "stratus";
            });
            if (catalog.length === 0) {
                return window.MAVORYI_PRODUCTS;
            }

            window.MAVORYI_PRODUCTS = catalog.map(function (product) {
                return Object.assign({}, localById[product.id] || {}, product);
            });
            return window.MAVORYI_PRODUCTS;
        })
        .catch(function () {
            return window.MAVORYI_PRODUCTS;
        });
})();
