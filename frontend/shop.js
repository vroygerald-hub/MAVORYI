(function () {
    var products = window.MAVORYI_PRODUCTS || [];

    function formatPrice(value) {
        if (value === null || value === undefined || value === "") return "";
        var amount = Number(value);
        if (!Number.isFinite(amount)) return "";
        return "GHS " + amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    var cartStorageKey = "mavoryi-cart";
    var whatsappNumber = "233549181995";

    function escapeHtml(value) {
        return String(value).replace(/[&<>"']/g, function (character) {
            return {
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                "\"": "&quot;",
                "'": "&#39;"
            }[character];
        });
    }

    function getCart() {
        try {
            var savedCart = JSON.parse(localStorage.getItem(cartStorageKey) || "[]");
            return Array.isArray(savedCart) ? savedCart.map(function (item) {
                if (item.id === "stratus") {
                    item.id = "nimbus";
                    item.color = "Wine";
                }
                return item;
            }) : [];
        } catch (error) {
            return [];
        }
    }

    function getProductVariant(product, color) {
        return (product.variants || []).find(function (variant) {
            return variant.color === color;
        }) || { name: product.name, color: product.color, image: product.image };
    }

    function productSlides(variant) {
        var image = variant.image;
        if (!image) {
            return "<div class=\"slide product-image-missing\"><span>Product image coming soon</span></div>" +
                "<div class=\"slide product-image-missing\"><span>Product image coming soon</span></div>" +
                "<div class=\"slide product-image-missing\"><span>Product image coming soon</span></div>";
        }

        return "<div class=\"slide\" role=\"img\" aria-label=\"" + escapeHtml(variant.name) + "\" style=\"background-image:url('" + escapeHtml(image) + "')\"></div>" +
            "<div class=\"slide\" role=\"img\" aria-label=\"Zoomed crop of " + escapeHtml(variant.name) + "\" style=\"background-image:url('" + escapeHtml(image) + "');background-size:125% auto\"></div>" +
            "<div class=\"slide\" role=\"img\" aria-label=\"Close-up crop of " + escapeHtml(variant.name) + "\" style=\"background-image:url('" + escapeHtml(image) + "');background-size:145% auto;background-position:54% 44%\"></div>";
    }

    function saveCart(cart) {
        try {
            localStorage.setItem(cartStorageKey, JSON.stringify(cart));
        } catch (error) {
            return false;
        }
        updateCartCounts(cart);
        return true;
    }

    function updateCartCounts(cart) {
        var count = cart.reduce(function (total, item) {
            return total + Math.max(0, Number(item.quantity) || 0);
        }, 0);

        document.querySelectorAll(".cart-count").forEach(function (element) {
            element.textContent = String(count);
        });
    }

    function productUrl(product) {
        return "product.html?id=" + encodeURIComponent(product.id);
    }

    function categoryKey(category) {
        if (category === "Travel bag") {
            return "bags";
        }
        var key = category.toLowerCase();
        return key.endsWith("s") ? key : key + "s";
    }

    function setupProductFilters() {
        var filters = document.querySelectorAll("[data-product-filter]");
        if (!filters.length) {
            return;
        }

        var filterPanel = document.querySelector("[data-category-filters-panel]");
        var filterToggle = document.querySelector(".category-filters-toggle");

        function setFilterPanelOpen(isOpen) {
            if (!filterPanel || !filterToggle) {
                return;
            }

            filterPanel.classList.toggle("is-collapsed", !isOpen);
            filterToggle.setAttribute("aria-expanded", String(isOpen));
            filterToggle.setAttribute("aria-label", isOpen ? "Hide product filters" : "Show product filters");
        }

        function applyFilter(filter) {
            filters.forEach(function (button) {
                button.setAttribute("aria-pressed", String(button.dataset.productFilter === filter));
            });

            document.querySelectorAll("[data-product-grid] .product-card").forEach(function (card) {
                card.hidden = filter !== "all" && card.dataset.category !== filter;
            });
        }

        filters.forEach(function (button) {
            button.addEventListener("click", function () {
                applyFilter(button.dataset.productFilter);
            });
        });

        if (filterToggle) {
            filterToggle.addEventListener("click", function () {
                var isOpen = !filterPanel.classList.contains("is-collapsed");
                setFilterPanelOpen(!isOpen);
            });
        }

        setFilterPanelOpen(false);
        applyFilter("all");
    }

    function renderFeatured() {
        var grid = document.querySelector("[data-product-grid]");
        if (!grid) {
            return;
        }

        grid.innerHTML = products.map(function (product) {
            var imagePhases = product.image
                ? [
                    "<div class=\"slide\" role=\"img\" aria-label=\"" + escapeHtml(product.name) + "\" style=\"background-image:url('" + escapeHtml(product.image) + "')\"></div>",
                    "<div class=\"slide\" role=\"img\" aria-label=\"Zoomed crop of " + escapeHtml(product.name) + "\" style=\"background-image:url('" + escapeHtml(product.image) + "');background-size:125% auto\"></div>",
                    "<div class=\"slide\" role=\"img\" aria-label=\"Close-up crop of " + escapeHtml(product.name) + "\" style=\"background-image:url('" + escapeHtml(product.image) + "');background-size:145% auto;background-position:54% 44%\"></div>"
                ].join("")
                : "<div class=\"slide product-image-missing\"><span>Product image coming soon</span></div>" +
                    "<div class=\"slide product-image-missing\"><span>Product image coming soon</span></div>" +
                    "<div class=\"slide product-image-missing\"><span>Product image coming soon</span></div>";
            var productLink = productUrl(product);
            var color = product.colors ? product.colors[0] : product.color;

            return "<article class=\"product-card\" data-category=\"" + escapeHtml(categoryKey(product.category)) + "\">" +
                "<div class=\"product-box slider\" data-slider>" +
                    "<div class=\"slides\">" + imagePhases + "</div>" +
                    "<a class=\"product-image-link\" href=\"" + productLink + "\" aria-label=\"View " + escapeHtml(product.name) + " details\"></a>" +
                    "<button class=\"slider-btn prev\" type=\"button\" aria-label=\"Previous image of " + escapeHtml(product.name) + "\">&#8249;</button>" +
                    "<button class=\"slider-btn next\" type=\"button\" aria-label=\"Next image of " + escapeHtml(product.name) + "\">&#8250;</button>" +
                    "<div class=\"slider-dots\" aria-label=\"Product images\"></div>" +
                "</div>" +
                "<div class=\"product-info\">" +
                    "<a class=\"product-label\" href=\"" + productLink + "\">" + escapeHtml(product.name) + "</a>" +
                    "<p class=\"product-specs\"><strong>Colour:</strong> " + escapeHtml(color) + "<br><strong>Material:</strong> <span class=\"material-value\">" + escapeHtml(product.material) + "</span></p>" +
                    "<p class=\"product-price\">" + escapeHtml(formatPrice(product.price)) + "</p>" +
                    "<a class=\"product-view-link\" href=\"" + productLink + "\">View details <span aria-hidden=\"true\">&#8594;</span></a>" +
                "</div>" +
            "</article>";
        }).join("");
        setupProductFilters();
        if (window.MAVORYI_REFRESH_SLIDERS) {
            window.MAVORYI_REFRESH_SLIDERS();
        }
    }

    function renderProductDetail() {
        if (document.body.dataset.shopPage !== "product") {
            return;
        }

        var params = new URLSearchParams(window.location.search);
        var product = products.find(function (item) {
            return item.id === (params.get("id") === "stratus" ? "nimbus" : params.get("id"));
        });

        if (!product) {
            document.querySelector(".product-detail-layout").innerHTML = "<div class=\"product-not-found\"><h2>Product not found</h2><a href=\"index.html#collection\">Browse featured products</a></div>";
            return;
        }

        document.title = "MAVORYI | " + product.name;
        var productName = document.querySelector("[data-product-name]");
        document.querySelector("[data-product-category]").textContent = product.category;
        document.querySelector("[data-product-price]").textContent = formatPrice(product.price);
        document.querySelector("[data-product-material]").textContent = product.material;
        document.querySelector("[data-product-type]").textContent = product.category;

        var slides = document.querySelector("[data-product-slides]");
        var colorSelect = document.querySelector("[data-product-colors]");
        var variants = product.variants || [{ name: product.name, color: product.color, image: product.image }];
        colorSelect.innerHTML = variants.map(function (variant) {
            return "<option value=\"" + escapeHtml(variant.color) + "\">" + escapeHtml(variant.name + " (" + variant.color + ")") + "</option>";
        }).join("");

        function showVariant(color) {
            var variant = getProductVariant(product, color);
            productName.textContent = variant.name;
            document.title = "MAVORYI | " + variant.name;
            slides.innerHTML = productSlides(variant);
            if (window.MAVORYI_REFRESH_SLIDERS) {
                window.MAVORYI_REFRESH_SLIDERS();
            }
        }

        showVariant(colorSelect.value);
        colorSelect.addEventListener("change", function () {
            showVariant(colorSelect.value);
        });

        document.querySelector("[data-add-to-cart]").addEventListener("click", function () {
            var cart = getCart();
            var existingItem = cart.find(function (item) {
                return item.id === product.id && item.color === colorSelect.value;
            });

            if (existingItem) {
                existingItem.quantity = (Number(existingItem.quantity) || 0) + 1;
            } else {
                cart.push({ id: product.id, color: colorSelect.value, quantity: 1 });
            }

            if (saveCart(cart)) {
                this.textContent = "Added to cart";
                window.setTimeout(function () {
                    var button = document.querySelector("[data-add-to-cart]");
                    if (button) button.textContent = "Add to cart";
                }, 1400);
            }
        });
    }

    function renderCart() {
        if (document.body.dataset.shopPage !== "cart") {
            return;
        }

        var cartItems = document.querySelector("[data-cart-items]");
        var cart = getCart();
        var validItems = cart.map(function (item) {
            return { item: item, product: products.find(function (product) { return product.id === item.id; }) };
        }).filter(function (entry) { return entry.product; });
        var quantity = validItems.reduce(function (total, entry) {
            return total + Math.max(0, Number(entry.item.quantity) || 0);
        }, 0);
        document.querySelector("[data-cart-quantity]").textContent = String(quantity);
        document.querySelector("[data-order-submit]").disabled = quantity === 0;
        document.querySelector("[data-payment-timing]").hidden = quantity === 0;
        var cartTotalKnown = validItems.length && validItems.every(function (entry) {
            return entry.product.price !== null && entry.product.price !== undefined && entry.product.price !== "" && Number.isFinite(Number(entry.product.price));
        });
        var cartTotal = cartTotalKnown ? validItems.reduce(function (total, entry) {
            return total + Number(entry.product.price) * Number(entry.item.quantity);
        }, 0) : null;
        document.querySelector("[data-cart-total]").textContent = formatPrice(cartTotal);
        updateCheckoutLink(validItems);

        if (!validItems.length) {
            cartItems.innerHTML = "<div class=\"cart-empty\"><h3>Your cart is empty</h3><p>Choose an item from the featured products to get started.</p><a class=\"button-primary\" href=\"index.html#collection\">Browse products</a></div>";
            return;
        }

        cartItems.innerHTML = validItems.map(function (entry) {
            var product = entry.product;
            var variant = getProductVariant(product, entry.item.color);
            var image = variant.image
                ? "<img src=\"" + escapeHtml(variant.image) + "\" alt=\"\" loading=\"lazy\">"
                : "<div class=\"cart-thumbnail-placeholder\">Image coming soon</div>";

            return "<article class=\"cart-item\" data-cart-item=\"" + escapeHtml(product.id) + "\" data-color=\"" + escapeHtml(entry.item.color) + "\">" +
                "<a class=\"cart-item-image\" href=\"" + productUrl(product) + "\">" + image + "</a>" +
                "<div class=\"cart-item-info\"><a href=\"" + productUrl(product) + "\"><h3>" + escapeHtml(variant.name) + "</h3></a>" +
                "<p>Colour: " + escapeHtml(entry.item.color) + "</p><p>" + escapeHtml(formatPrice(product.price)) + "</p>" +
                "<div class=\"cart-item-actions\"><button type=\"button\" data-quantity-change=\"-1\" aria-label=\"Decrease quantity\">&#8722;</button>" +
                "<span>" + Math.max(0, Number(entry.item.quantity) || 0) + "</span>" +
                "<button type=\"button\" data-quantity-change=\"1\" aria-label=\"Increase quantity\">&#43;</button>" +
                "<button class=\"cart-remove\" type=\"button\" data-remove-item>Remove</button></div></div></article>";
        }).join("");

        cartItems.querySelectorAll("[data-quantity-change], [data-remove-item]").forEach(function (button) {
            button.addEventListener("click", function () {
                var itemElement = button.closest("[data-cart-item]");
                var id = itemElement.dataset.cartItem;
                var color = itemElement.dataset.color;
                var nextCart = getCart().map(function (item) {
                    if (item.id === id && item.color === color && button.hasAttribute("data-quantity-change")) {
                        item.quantity = Number(item.quantity) + Number(button.dataset.quantityChange);
                    }
                    return item;
                }).filter(function (item) {
                    return item.quantity > 0 && !(item.id === id && item.color === color && button.hasAttribute("data-remove-item"));
                });
                saveCart(nextCart);
                renderCart();
            });
        });
    }

    function updateCheckoutLink(items) {
        var timingSelection = document.querySelector('[name="payment-timing"]:checked');
        var paymentTiming = timingSelection ? timingSelection.value : "before-delivery";
        var deliveryCost = document.querySelector("[data-delivery-cost]");
        var paymentOptions = document.querySelector("[data-payment-options]");

        paymentOptions.hidden = paymentTiming !== "before-delivery" || items.length === 0;

        if (paymentTiming === "on-delivery") {
            deliveryCost.textContent = "Fee to be confirmed";
        } else {
            deliveryCost.textContent = "Free";
        }
    }

    document.addEventListener("DOMContentLoaded", async function () {
        products = await (window.MAVORYI_CATALOG_READY || Promise.resolve(products));
        renderFeatured();
        renderProductDetail();
        renderCart();
        document.querySelectorAll('[name="payment-timing"], [name="payment-method"]').forEach(function (input) {
            input.addEventListener("change", function () {
                var cart = getCart();
                var items = cart.map(function (item) {
                    return { item: item, product: products.find(function (product) { return product.id === item.id; }) };
                }).filter(function (entry) { return entry.product; });
                updateCheckoutLink(items);
            });
        });
        updateCartCounts(getCart());
    });
})();
